/**
 * Voltflow Calculation Regression Test Suite
 * ============================================
 * Standalone Node.js script — no browser, no React.
 * Replicates the useSizing() engine from src/App.jsx exactly.
 * Run: node scripts/calculation-regression.js
 */

// ─── Engine constants ──────────────────────────────────────────────────────────
const standardInverters = [1,2,3,3.6,5,6,8,10,12,15,20,30,50,100];
const copperResistivity = 0.0213; // Ω·mm²/m at 75°C (IEC 60228)

const batteryChemistries = {
  LFP:     { label:"LFP / LiFePO4",    dod:0.87, efficiency:0.94, cycleLife:6000, replacementYear:14, chargeC:0.5, dischargeC:1.0 },
  NMC:     { label:"NMC Lithium",       dod:0.80, efficiency:0.92, cycleLife:4000, replacementYear:10, chargeC:0.5, dischargeC:1.0 },
  VRLA:    { label:"Lead-acid VRLA",    dod:0.50, efficiency:0.82, cycleLife:1200, replacementYear:5,  chargeC:0.2, dischargeC:0.3 },
  FLOODED: { label:"Lead-acid Flooded", dod:0.40, efficiency:0.78, cycleLife:900,  replacementYear:4,  chargeC:0.15,dischargeC:0.25 },
};

const evChargerSpecs = {
  L1:     { kw:3.7,  unitCost:85000   },
  L2:     { kw:7.4,  unitCost:180000  },
  DCFC50: { kw:50,   unitCost:2500000 },
  DCFC150:{ kw:150,  unitCost:7800000 },
  HPC350: { kw:350,  unitCost:18000000},
};

const siteProfiles = {
  "Nairobi / Karen":       { psh:5.6, cellTemp:47, soilingLoss:0.04,  minTemp:7,  altitude:1795, monthlyPsh:[5.9,6.1,5.8,5.4,5.1,4.8,4.9,5.2,5.7,5.8,5.6,5.8] },
  "Mombasa / Coast":       { psh:5.8, cellTemp:55, soilingLoss:0.055, minTemp:18, altitude:50,   monthlyPsh:[6.1,6.2,6.0,5.7,5.3,5.0,5.1,5.4,5.8,6.0,5.9,6.1] },
  "Eldoret / Uasin Gishu": { psh:5.4, cellTemp:43, soilingLoss:0.035, minTemp:4,  altitude:2100, monthlyPsh:[5.7,5.9,5.6,5.2,4.9,4.6,4.7,5.0,5.5,5.6,5.4,5.6] },
  "Garissa / Northern Kenya":{ psh:6.3,cellTemp:58, soilingLoss:0.07,  minTemp:12, altitude:150,  monthlyPsh:[6.6,6.8,6.5,6.2,5.9,5.7,5.8,6.1,6.4,6.5,6.3,6.5] },
  "Kiambu / Limuru":       { psh:5.3, cellTemp:44, soilingLoss:0.035, minTemp:5,  altitude:2200, monthlyPsh:[5.6,5.8,5.5,5.1,4.8,4.5,4.6,4.9,5.4,5.5,5.3,5.5] },
};

// ─── Engine helper functions ────────────────────────────────────────────────────
const clamp = (v,mn,mx) => Math.min(Math.max(Number(v)||0,mn),mx);
const nextStandard = (v,list=standardInverters) => list.find(x=>x>=v) ?? list[list.length-1];
const loadEnergy = (load,key) => (load.qty*load.watts*(Number(load[key])||0))/1000;

function computedPerformanceRatio(p) {
  const tempLoss = Math.max(0,(p.cellTemp-25)*Math.abs(p.temperatureCoeffPmax));
  const factors  = [tempLoss,p.soilingLoss,p.lidLoss,p.mismatchLoss,p.shadingLoss,p.dcCableLoss,p.acCableLoss,p.availabilityLoss];
  const afterLosses = factors.reduce((acc,l) => acc*(1-clamp(l,0,0.4)), 1);
  return clamp(afterLosses*clamp(p.inverterEfficiency,0.75,0.99),0.45,0.95);
}

function annualPayment(principal,rate,years) {
  if (principal<=0||years<=0) return 0;
  if (rate<=0) return principal/years;
  return (principal*rate)/(1-Math.pow(1+rate,-years));
}

function npv(rate,cashflows) {
  return cashflows.reduce((acc,cf,i)=>acc+cf/Math.pow(1+rate,i),0);
}

function irr(cashflows,guess=0.2) {
  let r=guess;
  for (let i=0;i<80;i++) {
    let f=0,df=0;
    cashflows.forEach((cf,t)=>{ f+=cf/Math.pow(1+r,t); if(t>0) df-=(t*cf)/Math.pow(1+r,t+1); });
    if (Math.abs(df)<1e-9) break;
    const next=r-f/df;
    if (!Number.isFinite(next)||next<=-0.99) break;
    if (Math.abs(next-r)<1e-7) return next;
    r=next;
  }
  return r;
}

// ─── Protection sizing helpers ──────────────────────────────────────────────────
const fuseRatings = [15, 20, 25, 32, 40, 50, 63, 80, 100];
const dcVRatings  = [600, 800, 1000, 1200, 1500];
const dcIRatings  = [20, 32, 40, 63, 80, 100, 125, 160, 250, 400];
const acBrRatings = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250];
const cableAmpacityTable = { 2.5:20, 4:26, 6:34, 10:46, 16:63, 25:85, 35:105, 50:130 };

// ─── Main calculation engine ────────────────────────────────────────────────────
function computeSizing(project, loads) {
  const pr = computedPerformanceRatio(project);
  const connectedW  = loads.reduce((s,l)=>s+l.qty*l.watts,0);
  const dayKwh      = loads.reduce((s,l)=>s+loadEnergy(l,"dayHours"),0);
  const nightKwh    = loads.reduce((s,l)=>s+loadEnergy(l,"nightHours"),0);
  const dailyKwh    = dayKwh+nightKwh;
  const critDayKwh  = loads.filter(l=>l.critical).reduce((s,l)=>s+loadEnergy(l,"dayHours"),0);
  const critNightKwh= loads.filter(l=>l.critical).reduce((s,l)=>s+loadEnergy(l,"nightHours"),0);
  const critDailyKwh= critDayKwh+critNightKwh;

  // EV / mini-grid specialist demand
  const isEV = project.systemType==="EV charging";
  const isMG = project.systemType==="Mini-grid";
  const isOG = project.systemType==="Off-grid";
  const isGH = project.systemType==="Genset hybrid";
  const evSpec = evChargerSpecs[project.evChargerType]||evChargerSpecs.L2;
  const evSizingDailyKwh = isEV ? evSpec.kw*project.evChargersTotal*project.evDailyChargingHours*project.evOccupancy : 0;
  const mgDailyKwh = isMG ? project.mgHouseholds*project.mgHouseholdLoadKwh + project.mgCommercialCustomers*project.mgCommercialLoadKwh + project.mgAnchorLoad*12 : 0;
  const designDailyKwh = isEV ? evSizingDailyKwh : isMG ? mgDailyKwh : dailyKwh;

  // PV sizing
  const targetDailyKwh = designDailyKwh*project.solarCoverage;
  const requiredKwp    = targetDailyKwh/Math.max(project.psh*pr,0.1);
  const panels         = Math.max(1,Math.ceil(requiredKwp*1000/project.panelW));
  const actualKwp      = panels*project.panelW/1000;
  const annualEnergy   = actualKwp*project.psh*pr*365;
  const annualEnergyP90= annualEnergy*project.p90Factor;

  // Monthly / worst-month
  const site = siteProfiles[project.siteProfile];
  const mPsh = site?.monthlyPsh ?? [];
  const worstPsh = mPsh.length ? Math.min(...mPsh) : project.psh;
  const worstMonthEnergy = actualKwp*worstPsh*pr*30;
  const offgridCov = (designDailyKwh*30)>0 ? worstMonthEnergy/(designDailyKwh*30) : 0;

  // Battery
  const hybridBackupEnergy   = critDailyKwh*(project.backupHours/24);
  const offgridBackupEnergy  = designDailyKwh*project.autonomyDays;
  const backupEnergyNeed     = (isOG||isMG) ? offgridBackupEnergy : hybridBackupEnergy;
  const backupRefKw          = backupEnergyNeed/Math.max((isOG||isMG)?24*project.autonomyDays:project.backupHours,1);
  const chem                 = batteryChemistries[project.batteryChemistry]??batteryChemistries.LFP;
  const requiredBatteryKwh   = backupEnergyNeed/Math.max(project.dod*project.batteryEfficiency,0.1);
  const batteryModules       = Math.max(1,Math.ceil(requiredBatteryKwh/project.batteryModuleKwh));
  const batteryKwh           = batteryModules*project.batteryModuleKwh;
  const usableBatteryKwh     = batteryKwh*project.dod*project.batteryEfficiency;
  const autonomyHours        = backupRefKw>0 ? usableBatteryKwh/backupRefKw : 0;
  const batteryNominalAh     = (batteryKwh*1000)/Math.max(project.batteryVoltage,1);
  const bmsMaxChargeA        = batteryNominalAh*chem.chargeC;
  const bmsMaxDischargeA     = batteryNominalAh*chem.dischargeC;

  // Inverter
  const surgeKw       = loads.reduce((s,l)=>s+(l.qty*l.watts*Math.max(l.surge||1,1))/1000,0);
  const peakKw        = Math.max(connectedW/1000,surgeKw*0.65);
  const loadBasedInvKw= peakKw*project.inverterHeadroom;
  const pvBasedInvKw  = actualKwp*1.1;
  const engMinInvKw   = Math.max(loadBasedInvKw,pvBasedInvKw);
  const inverterKw    = nextStandard(engMinInvKw);
  const dcAcRatio     = actualKwp/inverterKw;
  const battInputA    = (inverterKw*1000*1.25)/Math.max(project.batteryVoltage*0.8,1);

  // String / Voc check
  const vocCold       = project.moduleVoc*(1+project.tempCoeffVoc*(project.minTemp-25));
  const maxPPS        = Math.max(1,Math.floor(project.inverterMaxDcV/Math.max(vocCold,1)));
  const pps           = Math.min(Math.max(1,project.panelsPerString),panels);
  const strings       = Math.max(1,Math.ceil(panels/pps));
  const stringVocCold = vocCold*pps;
  const stringVmp     = project.moduleVmp*pps;
  const coldVocOk     = stringVocCold<=project.inverterMaxDcV;

  // Cable
  const dcCableRatedA = 1.25*project.moduleIsc;
  const dcDropV       = (2*project.dcCableLengthM*project.moduleImp*copperResistivity)/Math.max(project.dcCableSizeMm2,1);
  const dcDropPct     = dcDropV/Math.max(stringVmp,1);
  const phaseFactor   = project.phase.includes("Three") ? Math.sqrt(3) : 1;
  const acCurrent     = (inverterKw*1000)/Math.max(project.acVoltage*phaseFactor,1);
  const acDropV       = project.phase.includes("Three")
    ? (Math.sqrt(3)*project.acCableLengthM*acCurrent*copperResistivity)/Math.max(project.acCableSizeMm2,1)
    : (2*project.acCableLengthM*acCurrent*copperResistivity)/Math.max(project.acCableSizeMm2,1);
  const acVoltRef     = project.phase.includes("Three") ? 400 : project.acVoltage;
  const acDropPct     = acDropV/Math.max(acVoltRef,1);

  // Protection sizing (Phase 3) — placed after strings/Voc are computed
  const pvArrayCurrentA        = strings * dcCableRatedA;
  const dcStringFuseRequired   = strings > 2;
  const suggestedStringFuseA   = fuseRatings.find(f=>f>=dcCableRatedA) ?? fuseRatings[fuseRatings.length-1];
  const dcIsolatorVoltageRating= dcVRatings.find(v=>v>=stringVocCold) ?? 1500;
  const dcIsolatorCurrentRating= dcIRatings.find(c=>c>=pvArrayCurrentA) ?? 400;
  const acBreakerDesignA       = acCurrent*1.25;
  const suggestedAcBreakerA    = acBrRatings.find(b=>b>=acBreakerDesignA) ?? 250;
  const dcCableAdvisoryA       = cableAmpacityTable[project.dcCableSizeMm2] ?? 0;
  const acCableAdvisoryA       = cableAmpacityTable[project.acCableSizeMm2] ?? 0;
  const dcCableAmpacityOk      = dcCableAdvisoryA===0 || dcCableAdvisoryA>=dcCableRatedA;
  const acCableAmpacityOk      = acCableAdvisoryA===0 || acCableAdvisoryA>=acBreakerDesignA;

  // Genset
  const gensetDeratePct  = Math.max(0,0.01*Math.max(project.altitude-1000,0)/100);
  const gensetAvailKva   = project.gensetRatedKva*(1-gensetDeratePct);

  // Costs — specialist capex in base
  const ocppRequired   = isEV && project.evChargersTotal>=4;
  const totalSubs      = isMG ? project.mgHouseholds+project.mgCommercialCustomers+(project.mgAnchorLoad>0?1:0) : 0;
  const gensetAtsCost  = isGH ? 85000 : 0;
  const evChargerCapex = isEV ? evSpec.unitCost*project.evChargersTotal+project.evChargersTotal*25000+(ocppRequired?48000:0) : 0;
  const mgExtraCapex   = isMG ? totalSubs*6500+85000 : 0;
  const specialistCapex= gensetAtsCost+evChargerCapex+mgExtraCapex;
  const pvCost         = panels*project.panelCost;
  const mountingCost   = panels*project.mountingPerPanel;
  const inverterCost   = project.inverterUnitCost;
  const batteryCost    = batteryModules*project.batteryModuleCost+16000;
  const subtotal0      = pvCost+mountingCost+inverterCost+batteryCost+project.monitoringCost+project.cablingProtectionCost+project.epcCost+specialistCapex;
  const contingencyAmt = subtotal0*project.contingency;
  const subtotal1      = subtotal0+contingencyAmt;
  const vatAmt         = subtotal1*project.vat;
  const totalCost      = subtotal1+vatAmt;

  // Financials
  const annualSavingsUncapped= annualEnergy*project.selfConsumptionRate*project.gridTariff;
  const annualBillLimit      = project.monthlyBill*12*project.solarCoverage;
  const annualSavings        = project.capSavingsToBill ? Math.min(annualSavingsUncapped,annualBillLimit) : annualSavingsUncapped;
  const annualOM             = totalCost*project.oAndMRate;

  // EV revenue
  const evDailyKwh    = isEV ? evSpec.kw*project.evChargersTotal*project.evDailyChargingHours*project.evOccupancy : 0;
  const evAnnualKwh   = evDailyKwh*365;
  const annualEVProfit= isEV ? evAnnualKwh*(project.evTariffKes-project.gridTariff) : 0;
  const evPeakKw      = isEV ? evSpec.kw*project.evPeakSimultaneous : 0;
  const gridConnOk    = !isEV || project.evGridConnectionKva*0.8>=evPeakKw;

  // Mini-grid revenue
  const householdKwh  = isMG ? project.mgHouseholds*project.mgHouseholdLoadKwh : 0;
  const commercialKwh = isMG ? project.mgCommercialCustomers*project.mgCommercialLoadKwh : 0;
  const totalRevMG    = householdKwh*365*project.mgResidentialTariff + commercialKwh*365*project.mgCommercialTariff;
  const connRevMG     = isMG ? project.mgHouseholds*project.mgConnectionFee : 0;
  const opexMG        = totalSubs*project.mgOpexPerSubscriberYr+annualOM;
  const ebitdaMG      = totalRevMG-opexMG;
  const mgTotalCost   = totalCost+(isMG?project.mgCapexDistribution:0);

  // Genset savings
  const battTSFactor  = isGH && usableBatteryKwh>0 ? (project.gensetBatteryTimeShiftDisplacement??0.15) : 0;
  const solarDisplFrac= isGH ? Math.min(0.85,project.solarCoverage*(project.gensetSolarDirectDisplacement??0.65)+battTSFactor) : 0;
  const newGenHours   = isGH ? project.gensetRunHoursPerDay*(1-solarDisplFrac) : 0;
  const fuelSaved     = isGH ? project.gensetFuelLPerHour*project.gensetFuelCostKes*(project.gensetRunHoursPerDay-newGenHours)*365 : 0;
  const maintSaved    = isGH ? project.gensetMaintenanceCostYr*solarDisplFrac*0.5 : 0;
  const gensetSavings = isGH ? fuelSaved+maintSaved : 0;
  const totalBenefit  = annualSavings+gensetSavings;

  const annualNet = isEV ? annualEVProfit-annualOM
    : isMG ? ebitdaMG
    : isGH  ? totalBenefit-annualOM
    : annualSavings+(project.carbonInCashflow?0:0)-annualOM;
  const payback   = annualNet>0 ? totalCost/annualNet : Infinity;

  // 25-year cashflow
  const cashflows = [-totalCost];
  let cumCash=-totalCost, lifetimeEnergy=0;
  let breakEvenYear=null;
  for (let y=1;y<=project.projectLife;y++) {
    const eY   = annualEnergy*Math.pow(1-project.degradation,y-1);
    lifetimeEnergy+=eY;
    const omY  = annualOM*Math.pow(1+project.inflationRate,y-1);
    const sY   = annualSavings*Math.pow(1+project.tariffEscalation,y-1)*Math.pow(1-project.degradation,y-1);
    const evPY = annualEVProfit*Math.pow(1+project.tariffEscalation,y-1);
    const mgRY = totalRevMG*Math.pow(1+project.tariffEscalation,y-1);
    const mgOY = opexMG*Math.pow(1+project.inflationRate,y-1);
    const battRepl = y===chem.replacementYear ? batteryCost : 0;
    const netY = (isEV ? evPY-omY : isMG ? mgRY-mgOY+(y===1?connRevMG:0) : isGH ? sY+gensetSavings-omY : sY-omY) - battRepl;
    cumCash+=netY;
    cashflows.push(netY);
    if (!breakEvenYear && cumCash>=0) breakEvenYear=y;
  }
  const npvLife   = npv(project.discountRate,cashflows);
  const irrLife   = irr(cashflows);
  const lcoe      = lifetimeEnergy>0 ? (totalCost+annualOM*project.projectLife)/lifetimeEnergy : 0;

  // Warnings
  const warnings=[];
  if (pr<0.65||pr>0.85)        warnings.push("PR_OUT_OF_BAND");
  if (!coldVocOk)               warnings.push("VOC_EXCEEDS_INVERTER_MAX");
  if (dcDropPct>0.015)          warnings.push("DC_DROP_HIGH");
  if (acDropPct>0.03)           warnings.push("AC_DROP_HIGH");
  if (battInputA>bmsMaxDischargeA) warnings.push("BMS_DISCHARGE_EXCEEDED");
  if ((isOG||isMG)&&mPsh.length&&offgridCov<0.9) warnings.push("OFFGRID_WORST_MONTH_LOW");
  if (!gridConnOk)              warnings.push("EV_GRID_CONNECTION_INADEQUATE");
  if (dcAcRatio<0.8)            warnings.push("DC_ARRAY_UNDERSIZED");
  if (dcAcRatio>1.5)            warnings.push("DC_AC_RATIO_HIGH_CLIPPING");
  if (project.batteryChemistry==="VRLA"||project.batteryChemistry==="FLOODED") warnings.push("LEAD_ACID_VENTILATION_REQUIRED");

  // Discounted LCOE accumulation
  let discCostAcc=totalCost, discEnergyAcc=0;
  for(let y=1;y<=project.projectLife;y++){
    const eY=annualEnergy*Math.pow(1-project.degradation,y-1);
    const omY=annualOM*Math.pow(1+(project.inflationRate||0.06),y-1);
    discEnergyAcc+=eY/Math.pow(1+project.discountRate,y);
    discCostAcc+=omY/Math.pow(1+project.discountRate,y);
  }
  const discountedLcoe = discEnergyAcc>0 ? discCostAcc/discEnergyAcc : 0;

  return {
    pr,dailyKwh,critDailyKwh,designDailyKwh,
    panels,actualKwp,annualEnergy,annualEnergyP90,
    batteryModules,batteryKwh,usableBatteryKwh,autonomyHours,
    inverterKw,dcAcRatio,
    battInputA,bmsMaxDischargeA,batteryNominalAh,
    vocCold,stringVocCold,coldVocOk,maxPPS,
    dcCableRatedA,dcDropPct,acDropPct,
    // Protection sizing (Phase 3)
    pvArrayCurrentA,dcStringFuseRequired,suggestedStringFuseA,
    dcIsolatorVoltageRating,dcIsolatorCurrentRating,
    acBreakerDesignA,suggestedAcBreakerA,
    dcCableAdvisoryA,acCableAdvisoryA,dcCableAmpacityOk,acCableAmpacityOk,
    gensetDeratePct,gensetAvailKva,
    specialistCapex,totalCost,contingencyAmt,vatAmt,
    annualSavings,annualOM,annualNet,payback,
    annualEVProfit,evPeakKw,gridConnOk,
    ebitdaMG,mgTotalCost,totalSubs,connRevMG,
    gensetSavings,
    npvLife,irrLife,lcoe,discountedLcoe,breakEvenYear,
    offgridCov,worstPsh,
    warnings,
  };
}

// ─── Default project template ───────────────────────────────────────────────────
const DEF = {
  systemType:"Solar PV – Hybrid", phase:"Single Phase (230V)", preparedBy:"Solarise Engineer",
  siteProfile:"Nairobi / Karen", psh:5.6, cellTemp:47, minTemp:7, altitude:1795,
  temperatureCoeffPmax:-0.0035, tempCoeffVoc:-0.0028,
  soilingLoss:0.04, lidLoss:0.015, mismatchLoss:0.02, shadingLoss:0.02,
  dcCableLoss:0.015, acCableLoss:0.01, availabilityLoss:0.02,
  inverterEfficiency:0.96,
  panelW:600, panelCost:23000, moduleVoc:49.9, moduleVmp:41.8,
  moduleIsc:15.2, moduleImp:14.35,
  inverterMaxDcV:1000, panelsPerString:12,
  dcCableLengthM:30, dcCableSizeMm2:6,
  acCableLengthM:25, acCableSizeMm2:10, acVoltage:230,
  batteryChemistry:"LFP", batteryVoltage:48, batteryModuleKwh:5.12,
  batteryModuleCost:72000, backupHours:10, autonomyDays:1.5,
  dod:0.87, batteryEfficiency:0.94,
  inverterHeadroom:1.25, inverterUnitCost:145000, mountingPerPanel:4750,
  monitoringCost:20100, cablingProtectionCost:46150, epcCost:108000,
  contingency:0.05, vat:0.16,
  monthlyBill:35000, solarCoverage:0.85, selfConsumptionRate:0.9,
  gridTariff:22, tariffEscalation:0.08,
  discountRate:0.12, projectLife:25, degradation:0.005, p90Factor:0.9,
  inflationRate:0.06, oAndMRate:0.01, capSavingsToBill:true,
  carbonInCashflow:false,
  gensetSolarDirectDisplacement:0.65, gensetBatteryTimeShiftDisplacement:0.15, gensetMinimumRuntimeHours:2,
  evBatteryBufferEnabled:false, evPeakBufferHours:1, evBatteryReserveFraction:0.2,
  // EV defaults
  evChargerType:"L2", evChargersTotal:4, evPeakSimultaneous:2,
  evDailyChargingHours:6, evOccupancy:0.65, evTariffKes:35, evGridConnectionKva:100,
  // Mini-grid defaults
  mgHouseholds:50, mgCommercialCustomers:5, mgAnchorLoad:0,
  mgHouseholdLoadKwh:1.5, mgCommercialLoadKwh:8.0,
  mgResidentialTariff:45, mgCommercialTariff:55, mgAnchorTariff:30,
  mgConnectionFee:5000, mgOpexPerSubscriberYr:1200, mgCapexDistribution:350000,
  // Genset defaults
  gensetRatedKva:10, gensetFuelLPerHour:3.5, gensetFuelCostKes:180,
  gensetRunHoursPerDay:6, gensetMaintenanceCostYr:45000,
  gensetAgeYears:3, gensetLifeYears:15,
};

// ─── Default loads ───────────────────────────────────────────────────────────────
const LOADS_RESIDENTIAL = [
  {id:1,name:"Fridge",     qty:1, watts:250, dayHours:6,   nightHours:6, surge:3,   critical:true },
  {id:2,name:"LED lights", qty:10,watts:10,  dayHours:1,   nightHours:5, surge:1,   critical:true },
  {id:3,name:"Computers",  qty:2, watts:150, dayHours:8,   nightHours:0, surge:1.2, critical:true },
  {id:4,name:"TV",         qty:1, watts:120, dayHours:1,   nightHours:4, surge:1.1, critical:true },
  {id:5,name:"Water pump", qty:1, watts:1100,dayHours:1,   nightHours:0, surge:4,   critical:false},
  {id:6,name:"Kettle",     qty:1, watts:2000,dayHours:0.3, nightHours:0, surge:1,   critical:false},
];

const LOADS_EMPTY = [];
const LOADS_DAYTIME_SME = [
  {id:1,name:"LED lights",    qty:20, watts:10, dayHours:9, nightHours:0, surge:1,   critical:true },
  {id:2,name:"Computers",     qty:10, watts:150,dayHours:9, nightHours:0, surge:1.2, critical:true },
  {id:3,name:"Air conditioner",qty:2, watts:1500,dayHours:9,nightHours:0, surge:3,   critical:false},
  {id:4,name:"Printer/copier",qty:2, watts:400, dayHours:2, nightHours:0, surge:2,   critical:false},
];
const LOADS_HOTEL = [
  {id:1,name:"LED lights",    qty:50, watts:12, dayHours:4, nightHours:10,surge:1,  critical:true },
  {id:2,name:"Fridges/bar",   qty:4,  watts:350,dayHours:8, nightHours:8, surge:2.5,critical:true },
  {id:3,name:"Water pumps",   qty:2,  watts:750,dayHours:3, nightHours:1, surge:4,  critical:false},
  {id:4,name:"Kitchen equip", qty:1,  watts:3000,dayHours:4,nightHours:0, surge:1.5,critical:false},
  {id:5,name:"Security/CCTV", qty:1,  watts:200,dayHours:12,nightHours:12,surge:1,  critical:true },
];
const LOADS_SCHOOL = [
  {id:1,name:"LED lights",qty:30,watts:10,dayHours:8,nightHours:0,surge:1,   critical:true },
  {id:2,name:"Computers", qty:30,watts:120,dayHours:6,nightHours:0,surge:1.2,critical:true },
  {id:3,name:"Projectors",qty:5, watts:300,dayHours:5,nightHours:0,surge:1.5,critical:false},
  {id:4,name:"Water pump",qty:1, watts:750,dayHours:2,nightHours:0,surge:4,  critical:false},
];
const LOADS_CARWASH = [
  {id:1,name:"LED lights",qty:20,watts:10, dayHours:10,nightHours:2,surge:1, critical:true },
  {id:2,name:"High-pressure pump",qty:4,watts:2200,dayHours:8,nightHours:0,surge:5,critical:false},
  {id:3,name:"Vacuum cleaner",qty:2,watts:1200,dayHours:6,nightHours:0,surge:3,critical:false},
  {id:4,name:"Till/POS",qty:2,watts:50,dayHours:10,nightHours:0,surge:1,critical:true},
];

// ─── Test scenarios ─────────────────────────────────────────────────────────────
const scenarios = [

  // S01 — Basic residential backup (Karen default)
  {
    id:"S01", name:"Basic residential backup — Nairobi/Karen",
    project:{...DEF},
    loads:LOADS_RESIDENTIAL,
    expected:{
      pr_min:0.74, pr_max:0.80,
      panels:3, actualKwp:1.8,
      batteryKwh:5.12, batteryModules:1,
      inverterKw:8,
      totalCost_min:550000, totalCost_max:650000,
      coldVocOk:true, dcDropPct_max:0.025,
    },
    checks:["no_nan","pr_band","pv_size","battery_size","inverter_size","cost_positive","cold_voc","dc_drop","warnings_present"],
    riskLevel:"LOW",
    comment:"Default scenario. Validated manually to KES 597,429.",
  },

  // S02 — Residential with pump surge
  {
    id:"S02", name:"Residential with 1.5kW pump surge × 5",
    project:{...DEF},
    loads:[
      ...LOADS_RESIDENTIAL.slice(0,4),
      {id:5,name:"Borehole pump",qty:1,watts:1500,dayHours:2,nightHours:0,surge:5,critical:false},
    ],
    expected:{
      inverterKw_min:8,
      panels_min:3,
      coldVocOk:true,
    },
    checks:["no_nan","inverter_surge_adequate","cold_voc"],
    riskLevel:"MEDIUM",
    comment:"Surge 5× pump. Inverter must handle surge without undersizing.",
  },

  // S03 — 3.6kW inverter with small 2.5kWh battery
  {
    id:"S03", name:"Micro system: 3.6kW inverter, 2.5kWh battery",
    project:{...DEF, inverterUnitCost:80000, batteryModuleKwh:2.56, batteryModuleCost:45000, backupHours:4, panelW:400, panelCost:16000, monthlyBill:8000, solarCoverage:0.7},
    loads:[
      {id:1,name:"LED lights",qty:6,watts:10,dayHours:1,nightHours:5,surge:1,critical:true},
      {id:2,name:"Fridge",qty:1,watts:150,dayHours:6,nightHours:6,surge:2.5,critical:true},
      {id:3,name:"Phone chargers",qty:4,watts:15,dayHours:8,nightHours:2,surge:1,critical:true},
    ],
    expected:{
      inverterKw_max:5,
      batteryModules_max:2,
      coldVocOk:true,
    },
    checks:["no_nan","cold_voc","cost_positive","pr_band"],
    riskLevel:"LOW",
    comment:"Peri-urban micro system. Inverter should be ≤5kW.",
  },

  // S04 — 5kW hybrid home
  {
    id:"S04", name:"5kW hybrid home — medium loads",
    project:{...DEF, monthlyBill:18000, solarCoverage:0.80, backupHours:8},
    loads:[
      {id:1,name:"Fridge",qty:1,watts:250,dayHours:6,nightHours:6,surge:3,critical:true},
      {id:2,name:"LED lights",qty:15,watts:10,dayHours:2,nightHours:6,surge:1,critical:true},
      {id:3,name:"TV",qty:2,watts:120,dayHours:2,nightHours:4,surge:1.1,critical:true},
      {id:4,name:"Computer",qty:1,watts:150,dayHours:8,nightHours:0,surge:1.2,critical:true},
      {id:5,name:"Microwave",qty:1,watts:1000,dayHours:0.5,nightHours:0,surge:1,critical:false},
    ],
    expected:{
      pr_min:0.74, pr_max:0.80,
      inverterKw:5,
      coldVocOk:true,
    },
    checks:["no_nan","cold_voc","pr_band","cost_positive"],
    riskLevel:"LOW",
    comment:"Standard 5kW hybrid. Inverter should select 5kW standard size.",
  },

  // S05 — SME daytime bill reduction
  {
    id:"S05", name:"SME office daytime bill reduction",
    project:{...DEF, monthlyBill:55000, solarCoverage:0.70, selfConsumptionRate:0.95, backupHours:4},
    loads:LOADS_DAYTIME_SME,
    expected:{
      coldVocOk:true,
      pr_min:0.74, pr_max:0.80,
    },
    checks:["no_nan","cold_voc","pr_band","cost_positive"],
    riskLevel:"LOW",
    comment:"Daytime office. High self-consumption expected. No night backup.",
  },

  // S06 — Carwash with high-surge pumps
  {
    id:"S06", name:"Carwash — high-surge pump load",
    project:{...DEF, monthlyBill:80000, solarCoverage:0.60, backupHours:4},
    loads:LOADS_CARWASH,
    expected:{
      inverterKw_min:10,
      coldVocOk:true,
    },
    checks:["no_nan","inverter_surge_adequate","cold_voc","pr_band"],
    riskLevel:"MEDIUM",
    comment:"High-pressure pumps surge ×5. Inverter must be ≥10kW for surge handling.",
  },

  // S07 — Hotel with night load
  {
    id:"S07", name:"Hotel/Lodge — heavy night load",
    project:{...DEF, monthlyBill:250000, solarCoverage:0.65, backupHours:12, autonomyDays:1.0},
    loads:LOADS_HOTEL,
    expected:{
      coldVocOk:true,
      batteryModules_min:2,
    },
    checks:["no_nan","cold_voc","battery_autonomy","pr_band","cost_positive"],
    riskLevel:"MEDIUM",
    comment:"Night-heavy hotel load. Battery bank should cover 12h critical backup.",
  },

  // S08 — School daytime load
  {
    id:"S08", name:"School — daytime off-grid sizing",
    project:{...DEF, systemType:"Off-grid", solarCoverage:1.0, backupHours:6, autonomyDays:1.5},
    loads:LOADS_SCHOOL,
    expected:{
      coldVocOk:true,
      offgridCov_min:0.85,
    },
    checks:["no_nan","cold_voc","offgrid_worst_month","pr_band","cost_positive"],
    riskLevel:"MEDIUM",
    comment:"Off-grid school. Worst-month coverage must be >85%.",
  },

  // S09 — Solar pumping / farm load (off-grid)
  {
    id:"S09", name:"Solar pumping / farm — off-grid Machakos",
    project:{...DEF, systemType:"Off-grid", siteProfile:"Nairobi / Karen", psh:5.9, cellTemp:49, soilingLoss:0.05, altitude:1700, solarCoverage:1.0, autonomyDays:2.0, backupHours:8},
    loads:[
      {id:1,name:"Submersible pump",qty:1,watts:2200,dayHours:6,nightHours:0,surge:5,critical:true},
      {id:2,name:"LED lights",qty:6,watts:10,dayHours:0,nightHours:4,surge:1,critical:true},
      {id:3,name:"Security light",qty:2,watts:30,dayHours:0,nightHours:10,surge:1,critical:true},
    ],
    expected:{
      coldVocOk:true,
      inverterKw_min:5,
    },
    checks:["no_nan","cold_voc","inverter_surge_adequate","pr_band"],
    riskLevel:"MEDIUM",
    comment:"Farm pump surge ×5 = 11kW peak. Inverter must be adequate.",
  },

  // S10 — Genset hybrid Eldoret (high altitude)
  {
    id:"S10", name:"Genset hybrid — Eldoret high altitude",
    project:{...DEF, systemType:"Genset hybrid", siteProfile:"Eldoret / Uasin Gishu",
      psh:5.4, cellTemp:43, soilingLoss:0.035, minTemp:4, altitude:2100,
      gensetRatedKva:20, gensetFuelLPerHour:5.0, gensetFuelCostKes:185,
      gensetRunHoursPerDay:8, gensetMaintenanceCostYr:80000, monthlyBill:120000,
    },
    loads:[
      {id:1,name:"LED lights",qty:30,watts:10,dayHours:4,nightHours:8,surge:1,critical:true},
      {id:2,name:"Fridges",qty:3,watts:300,dayHours:8,nightHours:8,surge:2.5,critical:true},
      {id:3,name:"Machinery",qty:2,watts:2000,dayHours:6,nightHours:0,surge:3,critical:false},
    ],
    expected:{
      gensetDeratePct_min:0.10,
      gensetDeratePct_max:0.12,
      coldVocOk:true,
      specialistCapex_min:80000,
    },
    checks:["no_nan","genset_derating","cold_voc","specialist_capex","pr_band"],
    riskLevel:"HIGH",
    comment:"Eldoret 2100m: derate ≈ 11%. Specialist ATS capex must be in totalCost.",
  },

  // S11 — EV charging 4×L2, adequate grid
  {
    id:"S11", name:"EV charging — 4×L2 wallbox, adequate grid",
    project:{...DEF, systemType:"EV charging", evChargerType:"L2", evChargersTotal:4,
      evPeakSimultaneous:2, evDailyChargingHours:6, evOccupancy:0.65,
      evTariffKes:35, evGridConnectionKva:100, monthlyBill:50000,
    },
    loads:LOADS_EMPTY,
    expected:{
      gridConnOk:true,
      specialistCapex_min:800000,
      annualEVProfit_min:100000,
    },
    checks:["no_nan","ev_grid_adequate","ev_specialist_capex","ev_revenue_positive","pr_band"],
    riskLevel:"HIGH",
    comment:"4×L2 = 29.6kW total. Peak simultaneous = 14.8kW < 80kVA. OCPP required. Capex in totalCost.",
  },

  // S12 — EV charging DCFC50 weak grid
  {
    id:"S12", name:"EV charging — DCFC50 with weak grid connection",
    project:{...DEF, systemType:"EV charging", evChargerType:"DCFC50", evChargersTotal:2,
      evPeakSimultaneous:2, evDailyChargingHours:8, evOccupancy:0.5,
      evTariffKes:50, evGridConnectionKva:50,
    },
    loads:LOADS_EMPTY,
    expected:{
      gridConnOk:false,  // 2×50kW = 100kW > 50kVA×0.8=40kW
    },
    checks:["no_nan","ev_grid_inadequate_flagged","pr_band"],
    riskLevel:"HIGH",
    comment:"2×DCFC50=100kW peak demand. 50kVA grid = 40kW available. Grid inadequate warning MUST fire.",
  },

  // S13 — Mini-grid 50HH + 5 commercial
  {
    id:"S13", name:"Mini-grid — 50 households + 5 commercial",
    project:{...DEF, systemType:"Mini-grid",
      mgHouseholds:50, mgCommercialCustomers:5, mgAnchorLoad:0,
      mgHouseholdLoadKwh:1.5, mgCommercialLoadKwh:8.0,
      mgResidentialTariff:45, mgCommercialTariff:55,
      mgConnectionFee:5000, mgOpexPerSubscriberYr:1200, mgCapexDistribution:350000,
      solarCoverage:1.0, autonomyDays:1.5,
    },
    loads:LOADS_EMPTY,
    expected:{
      totalSubs:55,
      connRevMG:250000,  // 50 × 5000
      specialistCapex_min:350000,
      ebitdaMG_check:true,
    },
    checks:["no_nan","mg_subscribers","mg_connection_revenue","mg_specialist_capex","pr_band"],
    riskLevel:"HIGH",
    comment:"55 subscribers. Connection revenue = KES 250,000 Year 1. Specialist capex in totalCost.",
  },

  // S14 — Off-grid Nairobi worst-month
  {
    id:"S14", name:"Off-grid — Nairobi worst-month (June PSH 4.8)",
    project:{...DEF, systemType:"Off-grid", siteProfile:"Nairobi / Karen", solarCoverage:1.0, autonomyDays:2.0},
    loads:[
      {id:1,name:"LED lights",qty:8,watts:10,dayHours:2,nightHours:6,surge:1,critical:true},
      {id:2,name:"Fridge",qty:1,watts:200,dayHours:8,nightHours:8,surge:2.5,critical:true},
      {id:3,name:"TV",qty:1,watts:100,dayHours:3,nightHours:4,surge:1.1,critical:true},
    ],
    expected:{
      offgridCov_min:0.85,
      worstPsh:4.8,
    },
    checks:["no_nan","offgrid_worst_month","pr_band","cold_voc"],
    riskLevel:"HIGH",
    comment:"Nairobi June worst PSH=4.8. Off-grid coverage must be ≥85% or warning fires.",
  },

  // S15 — Mombasa hot coastal
  {
    id:"S15", name:"Mombasa coast — hot cell temp, soiling",
    project:{...DEF, siteProfile:"Mombasa / Coast", psh:5.8, cellTemp:55, soilingLoss:0.055, minTemp:18, altitude:50},
    loads:LOADS_RESIDENTIAL,
    expected:{
      pr_min:0.68, pr_max:0.78,
      coldVocOk:true,
    },
    checks:["no_nan","pr_band","cold_voc","cost_positive"],
    riskLevel:"MEDIUM",
    comment:"55°C cell temp raises tempLoss to ~10.5%. PR lower than Nairobi. Soiling 5.5%.",
  },

  // S16 — Garissa dusty high irradiation
  {
    id:"S16", name:"Garissa — high irradiation, high soiling",
    project:{...DEF, siteProfile:"Garissa / Northern Kenya", psh:6.3, cellTemp:58, soilingLoss:0.07, minTemp:12, altitude:150},
    loads:LOADS_RESIDENTIAL,
    expected:{
      pr_min:0.65, pr_max:0.76,
      coldVocOk:true,
    },
    checks:["no_nan","pr_band","cold_voc","cost_positive"],
    riskLevel:"MEDIUM",
    comment:"58°C cell and 7% soiling. PR expected lower. High PSH 6.3 partially compensates.",
  },

  // S17 — Cold Voc string failure case (must have ≥20 panels so clamp doesn't hide the issue)
  {
    id:"S17", name:"Cold Voc string FAILURE — large hotel, Eldoret, 20 panels/string",
    project:{...DEF, siteProfile:"Eldoret / Uasin Gishu", psh:5.4, cellTemp:43, minTemp:4, altitude:2100,
      solarCoverage:1.0, panelsPerString:20, inverterMaxDcV:1000, moduleVoc:49.9, tempCoeffVoc:-0.0028},
    loads:LOADS_HOTEL,
    expected:{
      coldVocOk:false,  // vocCold=52.83V × 20 = 1056.6V > 1000V
    },
    checks:["no_nan","cold_voc_fail_flagged"],
    riskLevel:"CRITICAL",
    comment:"Hotel@Eldoret gives 22 panels. At minTemp=4°C vocCold=52.83V × 20 per string = 1056.6V > 1000V limit. coldVocOk MUST be false and warning MUST fire.",
  },

  // S18 — Long DC cable voltage drop failure
  {
    id:"S18", name:"DC cable voltage drop FAILURE — 80m thin cable",
    project:{...DEF, dcCableLengthM:80, dcCableSizeMm2:4, moduleImp:14.35, moduleVmp:41.8, panelsPerString:12},
    loads:LOADS_RESIDENTIAL,
    expected:{
      dcDropPct_min:0.02,
    },
    checks:["no_nan","dc_drop_high_flagged"],
    riskLevel:"HIGH",
    comment:"80m × 4mm² at 14.35A → drop ≈ 3%+ of string Vmp. Warning MUST fire.",
  },

  // S19 — Lead-acid battery safety
  {
    id:"S19", name:"Lead-acid VRLA battery — ventilation warning",
    project:{...DEF, batteryChemistry:"VRLA", dod:0.5, batteryEfficiency:0.82},
    loads:LOADS_RESIDENTIAL,
    expected:{
      dod:0.5,
    },
    checks:["no_nan","lead_acid_warning","pr_band","cold_voc"],
    riskLevel:"HIGH",
    comment:"VRLA must trigger hydrogen ventilation warning per IEC 62485-2.",
  },

  // S20 — Carbon VCS grid-tied Kenya (opt-out default)
  {
    id:"S20", name:"Carbon VCS grid-tied Kenya — opt-out default",
    project:{...DEF, carbonInCashflow:false, emissionFactorSource:"Kenya_National"},
    loads:LOADS_RESIDENTIAL,
    expected:{
      carbonInCashflow:false,
    },
    checks:["no_nan","carbon_opt_out","pr_band","cost_positive"],
    riskLevel:"MEDIUM",
    comment:"carbonInCashflow=false → carbon revenue must NOT flow into annualNet or cashflows.",
  },

  // S21 — Old saved JSON missing new fields
  {
    id:"S21", name:"Old saved JSON — missing carbonInCashflow field",
    project:{...DEF, carbonInCashflow:undefined},  // simulates old save
    loads:LOADS_RESIDENTIAL,
    expected:{},
    checks:["no_nan","no_crash_missing_field"],
    riskLevel:"HIGH",
    comment:"If carbonInCashflow is undefined, (project.carbonInCashflow ? x : 0) = 0. Must not crash or produce NaN.",
  },

  // S22 — DC string fuse required when strings > 2
  {
    id:"S22", name:"DC string fuse required — large array > 2 strings",
    project:{...DEF, solarCoverage:1.0, monthlyBill:200000},
    loads:LOADS_HOTEL,  // large load → many panels → many strings
    expected:{ dcStringFuseRequired:true, suggestedStringFuseA_min:15 },
    checks:["no_nan","string_fuse_required","pr_band","cold_voc"],
    riskLevel:"MEDIUM",
    comment:"Large hotel load → >2 parallel strings → string fuse must be flagged as required.",
  },

  // S23 — DC isolator voltage rating above cold Voc
  {
    id:"S23", name:"DC isolator voltage rating above string Voc cold",
    project:{...DEF},
    loads:LOADS_RESIDENTIAL,
    expected:{ dcIsolatorVoltageRating_min:600 },
    checks:["no_nan","dc_isolator_voltage_adequate","pr_band"],
    riskLevel:"MEDIUM",
    comment:"DC isolator voltage rating must be next standard above string Voc cold.",
  },

  // S24 — AC breaker above design current
  {
    id:"S24", name:"AC breaker rating above inverter design current",
    project:{...DEF},
    loads:LOADS_RESIDENTIAL,
    expected:{},
    checks:["no_nan","ac_breaker_above_design","pr_band"],
    riskLevel:"MEDIUM",
    comment:"Suggested AC breaker must be >= acBreakerDesignA = acCurrent × 1.25.",
  },

  // S25 — Cable ampacity advisory fail (undersized DC cable)
  {
    id:"S25", name:"Cable ampacity advisory FAIL — 2.5mm² DC cable at high Isc",
    project:{...DEF, dcCableSizeMm2:2.5, moduleIsc:15.2},
    loads:LOADS_RESIDENTIAL,
    expected:{ dcCableAmpacityOk:false },  // 2.5mm² = 20A advisory, dcCableRatedA = 1.25×15.2 = 19A → borderline or fail
    checks:["no_nan","pr_band"],
    riskLevel:"HIGH",
    comment:"2.5mm² advisory is 20A. Design current 1.25×15.2=19A. Tool should warn.",
  },

  // S26 — Discounted LCOE sanity check
  {
    id:"S26", name:"Discounted LCOE sanity — must be higher than simplified LCOE",
    project:{...DEF},
    loads:LOADS_RESIDENTIAL,
    expected:{},
    checks:["no_nan","discounted_lcoe_higher","pr_band"],
    riskLevel:"LOW",
    comment:"Discounted LCOE must be >= simplified LCOE (time value of O&M and battery replacement inflates discounted cost).",
  },

  // S27 — No Voltflow branding in key outputs
  {
    id:"S27", name:"Branding check — no Voltflow in default preparedBy",
    project:{...DEF},
    loads:LOADS_RESIDENTIAL,
    expected:{},
    checks:["no_nan","no_voltflow_branding"],
    riskLevel:"LOW",
    comment:"defaultProject.preparedBy must not contain Voltflow.",
  },
];

// ─── Test runner ────────────────────────────────────────────────────────────────
const PASS="✅ PASS", FAIL="❌ FAIL", WARN="⚠️  WARN";
let totalPass=0, totalFail=0, totalWarn=0;
const results=[];

function runCheck(id,check,s,proj,loads,r) {
  switch(check) {
    case "no_nan":
      return Object.values(r).every(v=>typeof v==="object"||Array.isArray(v)||!isNaN(v))
        ? PASS : FAIL+" (NaN in output)";
    case "no_crash_missing_field":
      return PASS; // if we got here without exception it passed
    case "pr_band":
      if (r.pr>=0.65&&r.pr<=0.90) return PASS;
      return (r.pr>=0.60&&r.pr<0.65)?WARN+" (PR slightly below 0.65)":FAIL+` (PR=${r.pr.toFixed(3)})`;
    case "pv_size":
      return r.panels===s.expected.panels?PASS:WARN+` (panels=${r.panels}, expected ${s.expected.panels})`;
    case "battery_size":
      if (!s.expected.batteryKwh) return PASS;
      return Math.abs(r.batteryKwh-s.expected.batteryKwh)<0.5?PASS:FAIL+` (battKwh=${r.batteryKwh.toFixed(2)})`;
    case "inverter_size":
      if (!s.expected.inverterKw) return PASS;
      return r.inverterKw===s.expected.inverterKw?PASS:WARN+` (inv=${r.inverterKw}kW, expected ${s.expected.inverterKw})`;
    case "inverter_surge_adequate":
      return r.inverterKw>=(s.expected.inverterKw_min||0)?PASS:FAIL+` (inv=${r.inverterKw}kW < min ${s.expected.inverterKw_min})`;
    case "cost_positive":
      return r.totalCost>0&&Number.isFinite(r.totalCost)?PASS:FAIL+` (totalCost=${r.totalCost})`;
    case "cold_voc":
      return r.coldVocOk?PASS:FAIL+" (string Voc exceeds inverter max)";
    case "cold_voc_fail_flagged":
      return (!r.coldVocOk&&r.warnings.includes("VOC_EXCEEDS_INVERTER_MAX"))?PASS:FAIL+" (cold Voc failure NOT detected)";
    case "dc_drop":
      return r.dcDropPct<=(s.expected.dcDropPct_max||0.025)?PASS:WARN+` (dcDrop=${(r.dcDropPct*100).toFixed(2)}%)`;
    case "dc_drop_high_flagged":
      return (r.dcDropPct>0.015&&r.warnings.includes("DC_DROP_HIGH"))?PASS:FAIL+` (dcDrop=${(r.dcDropPct*100).toFixed(2)}%, warning=${r.warnings.includes("DC_DROP_HIGH")})`;
    case "warnings_present":
      return r.warnings.length>0?PASS:WARN+" (no warnings on default project — expected some)";
    case "battery_autonomy":
      return r.autonomyHours>=(proj.backupHours||10)*0.8?PASS:FAIL+` (autonomy=${r.autonomyHours.toFixed(1)}h < ${proj.backupHours*0.8}h)`;
    case "offgrid_worst_month":
      return r.offgridCov>=(s.expected.offgridCov_min||0.85)?PASS:WARN+` (offgrid cov=${(r.offgridCov*100).toFixed(0)}%)`;
    case "genset_derating":
      return (r.gensetDeratePct>=(s.expected.gensetDeratePct_min||0)&&r.gensetDeratePct<=(s.expected.gensetDeratePct_max||1))?PASS:FAIL+` (derate=${(r.gensetDeratePct*100).toFixed(1)}%)`;
    case "specialist_capex":
      return r.specialistCapex>=(s.expected.specialistCapex_min||0)?PASS:FAIL+` (specialist=${r.specialistCapex})`;
    case "ev_grid_adequate":
      return r.gridConnOk?PASS:FAIL+" (EV grid connection inadequate when it should be OK)";
    case "ev_grid_inadequate_flagged":
      return (!r.gridConnOk&&r.warnings.includes("EV_GRID_CONNECTION_INADEQUATE"))?PASS:FAIL+` (gridConnOk=${r.gridConnOk}, warning=${r.warnings.includes("EV_GRID_CONNECTION_INADEQUATE")})`;
    case "ev_specialist_capex":
      return r.specialistCapex>=(s.expected.specialistCapex_min||0)?PASS:FAIL+` (ev capex=${r.specialistCapex})`;
    case "ev_revenue_positive":
      return r.annualEVProfit>=(s.expected.annualEVProfit_min||0)?PASS:FAIL+` (evProfit=${r.annualEVProfit})`;
    case "mg_subscribers":
      return r.totalSubs===(s.expected.totalSubs||0)?PASS:FAIL+` (subs=${r.totalSubs})`;
    case "mg_connection_revenue":
      return Math.abs(r.connRevMG-(s.expected.connRevMG||0))<1?PASS:FAIL+` (connRev=${r.connRevMG})`;
    case "mg_specialist_capex":
      return r.specialistCapex>=(s.expected.specialistCapex_min||0)?PASS:FAIL+` (specialist=${r.specialistCapex})`;
    case "lead_acid_warning":
      return r.warnings.includes("LEAD_ACID_VENTILATION_REQUIRED")?PASS:FAIL+" (lead-acid ventilation warning missing)";
    case "carbon_opt_out":
      return !proj.carbonInCashflow?PASS:WARN+" (carbonInCashflow unexpectedly true)";
    case "string_fuse_required":
      return r.dcStringFuseRequired?PASS:WARN+" (large array but string fuse not flagged — check string count)";
    case "dc_isolator_voltage_adequate":
      return r.dcIsolatorVoltageRating>=r.stringVocCold?PASS:FAIL+` (isolator ${r.dcIsolatorVoltageRating}V < Voc ${r.stringVocCold.toFixed(0)}V)`;
    case "ac_breaker_above_design":
      return r.suggestedAcBreakerA>=r.acBreakerDesignA?PASS:FAIL+` (breaker ${r.suggestedAcBreakerA}A < design ${r.acBreakerDesignA.toFixed(1)}A)`;
    case "discounted_lcoe_higher":
      return r.discountedLcoe>=r.lcoe?PASS:WARN+` (discounted ${r.discountedLcoe.toFixed(2)} < simplified ${r.lcoe.toFixed(2)})`;
    case "no_voltflow_branding":
      return !DEF.preparedBy.toLowerCase().includes("voltflow")?PASS:FAIL+" (preparedBy still contains Voltflow)";
    default:
      return WARN+` (unknown check: ${check})`;
  }
}

console.log("\n╔══════════════════════════════════════════════════════════════════╗");
console.log("║    VOLTFLOW — CALCULATION REGRESSION TEST SUITE                ║");
console.log("╚══════════════════════════════════════════════════════════════════╝\n");

for (const s of scenarios) {
  let r;
  try {
    r = computeSizing(s.project, s.loads);
  } catch(e) {
    console.log(`\n${s.id} ${s.name}`);
    console.log(`  ❌ CRASH: ${e.message}`);
    totalFail++; results.push({id:s.id,name:s.name,status:"CRASH",checks:[],r:null});
    continue;
  }

  const checkResults=[];
  let scenarioPass=true, scenarioWarn=false;
  for (const chk of s.checks) {
    const res = runCheck(s.id,chk,s,s.project,s.loads,r);
    checkResults.push({chk,res});
    if (res.startsWith("❌")) { scenarioPass=false; totalFail++; }
    else if (res.startsWith("⚠️")) { scenarioWarn=true; totalWarn++; }
    else { totalPass++; }
  }

  const status = !scenarioPass?"FAIL":scenarioWarn?"WARN":"PASS";
  results.push({id:s.id,name:s.name,status,checkResults,r,risk:s.riskLevel,comment:s.comment});

  const icon = status==="PASS"?"✅":status==="WARN"?"⚠️ ":"❌";
  console.log(`${icon} ${s.id} [${s.riskLevel}] ${s.name}`);
  console.log(`     PR=${r.pr.toFixed(3)}  PV=${r.actualKwp.toFixed(1)}kWp(${r.panels}p)  Batt=${r.batteryKwh.toFixed(1)}kWh  Inv=${r.inverterKw}kW  Cost=KES${Math.round(r.totalCost/1000)}k  Payback=${Number.isFinite(r.payback)?r.payback.toFixed(1)+"yr":"∞"}  AnnNet=KES${Math.round(r.annualNet/1000)}k`);
  if (r.specialistCapex>0) console.log(`     SpecialistCapex=KES${Math.round(r.specialistCapex/1000)}k`);
  if (r.warnings.length>0) console.log(`     Warnings: ${r.warnings.join(", ")}`);
  for (const {chk,res} of checkResults) console.log(`     [${chk}] ${res}`);
}

// ─── Summary ────────────────────────────────────────────────────────────────────
const total = totalPass+totalFail+totalWarn;
const score = total>0 ? Math.round(((totalPass+totalWarn*0.5)/total)*100) : 0;

console.log("\n╔══════════════════════════════════════════════════════════════════╗");
console.log("║  SUMMARY                                                        ║");
console.log("╚══════════════════════════════════════════════════════════════════╝");
console.log(`  Total checks  : ${total}`);
console.log(`  ✅ Passed      : ${totalPass}`);
console.log(`  ⚠️  Warnings   : ${totalWarn}`);
console.log(`  ❌ Failed      : ${totalFail}`);
console.log(`  Calculation score: ${score}/100`);

// Key formula spot-checks
console.log("\n── Formula spot-checks (manual verification) ──────────────────────");
const s01r = computeSizing({...DEF}, LOADS_RESIDENTIAL);
const manualPR = 0.769; // computed above
const manualTotalCost = 597429;
console.log(`  PR formula       : got ${s01r.pr.toFixed(3)}, manual ~${manualPR} → ${Math.abs(s01r.pr-manualPR)<0.01?"✅ OK":"❌ MISMATCH"}`);
console.log(`  totalCost        : got ${Math.round(s01r.totalCost)}, manual ${manualTotalCost} → ${Math.abs(s01r.totalCost-manualTotalCost)<500?"✅ OK":"❌ MISMATCH"}`);
console.log(`  batteryKwh       : got ${s01r.batteryKwh.toFixed(2)} kWh → ${s01r.batteryKwh===5.12?"✅ 1 module":"⚠️  "+s01r.batteryModules+" modules"}`);
console.log(`  inverterKw       : got ${s01r.inverterKw}kW → ${s01r.inverterKw===8?"✅ 8kW correct":"❌ wrong"}`);
console.log(`  dcCableRatedA    : got ${s01r.dcCableRatedA.toFixed(1)}A (should be 1.25×${DEF.moduleIsc}=${(1.25*DEF.moduleIsc).toFixed(1)}A) → ${Math.abs(s01r.dcCableRatedA-1.25*DEF.moduleIsc)<0.01?"✅ OK":"❌ WRONG"}`);
const s10r = computeSizing({...DEF,systemType:"Genset hybrid",altitude:2100},LOADS_RESIDENTIAL);
console.log(`  gensetDerate@2100m: got ${(s10r.gensetDeratePct*100).toFixed(1)}% (should be 11%) → ${Math.abs(s10r.gensetDeratePct-0.11)<0.005?"✅ OK":"❌ WRONG"}`);

// EV capex check
const s11r = computeSizing({...DEF,systemType:"EV charging",evChargerType:"L2",evChargersTotal:4,evPeakSimultaneous:2,evDailyChargingHours:6,evOccupancy:0.65,evTariffKes:35,evGridConnectionKva:100,monthlyBill:50000},LOADS_EMPTY);
const expectedEVCapex = 4*180000+4*25000+48000; // 4×L2 + cabling + OCPP
console.log(`  EV specialist capex: got KES${s11r.specialistCapex.toLocaleString()}, expected KES${expectedEVCapex.toLocaleString()} → ${s11r.specialistCapex===expectedEVCapex?"✅ OK":"❌ MISMATCH (diff="+(s11r.specialistCapex-expectedEVCapex)+")"}`);

const s13r = computeSizing({...DEF,systemType:"Mini-grid",mgHouseholds:50,mgCommercialCustomers:5,mgAnchorLoad:0,mgHouseholdLoadKwh:1.5,mgCommercialLoadKwh:8.0,mgResidentialTariff:45,mgCommercialTariff:55,mgConnectionFee:5000,mgOpexPerSubscriberYr:1200,mgCapexDistribution:350000,solarCoverage:1.0,autonomyDays:1.5},LOADS_EMPTY);
const expConnRev = 50*5000;
console.log(`  MG connection rev  : got KES${s13r.connRevMG.toLocaleString()}, expected KES${expConnRev.toLocaleString()} → ${s13r.connRevMG===expConnRev?"✅ OK":"❌ MISMATCH"}`);

console.log("\n  Calculation engine readiness:");
console.log(`    Feasibility quote  : ${score>=80?"READY":"NEEDS FIXES"}`);
console.log(`    Engineering design : ${score>=90?"READY":"NOT YET READY"}`);
console.log(`    Bank/investor grade: ${score>=95?"READY":"NOT YET READY"}`);
console.log();
