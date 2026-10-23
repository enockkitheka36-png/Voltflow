import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import "./App.css";
import { BrandLogo } from "./components/BrandLogo.jsx";
import EquipmentMatchingPanel from "./components/EquipmentMatchingPanel.jsx";
import ElectricityTariffPanel from "./components/ElectricityTariffPanel.jsx";
import { normalizeTariffState, evaluateProjectTariff, gateTariffSizing, tariffToday } from "./utils/electricityTariff.js";
import { normalizeEquipmentSelection, resolveEquipmentProject, equipmentPanelCount, equipmentBatteryCount, equipmentBankLimits, gateEquipmentSizing } from "./utils/equipmentMatching.js";
import { WorkspaceHome } from "./components/workspace/WorkspaceHome.jsx";
import { WorkspaceNavigation } from "./components/workspace/WorkspaceNavigation.jsx";
import { WorkspaceHeader } from "./components/workspace/WorkspaceHeader.jsx";
import { getWorkspaceNavigation } from "./utils/workspaceNavigation.js";
import { SaveFeedback } from "./components/SaveFeedback.jsx";
import { canExportProjectBackup, saveCloudProjectAndRefresh } from "./utils/projectSave.js";
import {
  PageHeader, SectionHeader, CardGrid, FormGrid, ActionBar, StickySummaryPanel,
  ResponsiveTable, ResponsiveDataTable, EmptyState, StatusPill, WarningPanel,
  Spinner, Skeleton, SmartNumberField, PresetChips, ReadinessRing, ProgressCard,
} from "./components/ui.jsx";
import { buildAssistantContext, ASSISTANT_DISCLAIMER } from "./utils/assistantContext.js";
import { buildProjectAdvice } from "./utils/projectAdvisor.js";
import { buildProjectReadiness, READINESS_STATUS } from "./utils/readinessEngine.js";
import { computeNightAutonomy } from "./utils/nightAutonomy.js";
import { isTabAllowedInView, resolveBackTarget, highlightClass } from "./utils/navigation.js";
import { computeInverterSizing, computeDcAcAnalysis, computeStringSizing, INVERTER_BASES, DEFAULT_RUNNING_DIVERSITY, DEFAULT_SURGE_DIVERSITY } from "./utils/inverterCoherence.js";
import {
  computeBorehole, createDefaultBorehole, normalizeBorehole, buildBoreholeBoQ,
  summarizeBoreholeForProposal, summarizeBoreholeForTechnician,
  USE_CASE_PRESETS, PUMP_TYPE_PRESETS, POWER_MODE_PRESETS, estimateWaterDemand,
  validateBoreholeOperatingPoint, PUMP_SELECTION_DISCLAIMER,
} from "./utils/boreholeEngine.js";
// v11.7 — Evidence Reports + Cloud-Ready Project Record
import { buildReport, REPORT_MODES, REPORT_LABELS, reportToText } from "./utils/reportBuilder.js";
import { recordAudit, loadAuditLog, clearAuditLog, AUDIT_EVENT_TYPES, formatAuditTime } from "./utils/auditLog.js";
import { createDefaultEvidence, normalizeEvidence, recordEvidenceChange, markReportGenerated, createDefaultPilotEvidence, normalizePilotEvidence, APPROVAL_STATUSES, CONFIDENCE_LEVELS } from "./utils/projectEvidence.js";
import { createDefaultCompliance, normalizeCompliance, summarizeCompliance, COMPLIANCE_TEMPLATE, COMPLIANCE_STATUSES } from "./utils/complianceEngine.js";
// v11.7 — Voltflow Studio (Canva-like builder)
import { TEMPLATES, listTemplates, getTemplate, applyTemplate } from "./utils/projectTemplates.js";
import { SCENARIOS, getScenario, buildScenarioProject, scenarioConfidence, backupExpectation } from "./utils/scenarios.js";
import { explain, EXPLAIN_KEYS } from "./utils/explainers.js";
import { ASSET_CATEGORIES, DEFAULT_ASSETS, listAssets, getAsset, createAssetSelection, normalizeAssetSelections, assetCompatibilityWarning } from "./utils/assetLibrary.js";
import { getCommercialAvailability } from "./utils/inventoryAvailability.js";
import { normalizeBatterySelection, deriveBatterySelection } from "./utils/batterySelection.js";
import { calculateQuote, projectQuoteLines } from "./utils/quoteEngine.js";
import { createDesignRevision, computeOptionSizing, deriveSystemOptions, settleFailedDesignRevision, DESIGN_CALCULATION_VERSION } from "./utils/designRevision.js";
import { PHOTO_TYPES, validatePhotoUpload, uploadRetryDelay } from "./utils/photoEvidence.js";
import { buildStudioBlocks, studioProgressPct } from "./utils/studioBlocks.js";
import { PROPOSAL_SECTIONS, PROPOSAL_STUDIO_MODES, createDefaultProposalStudioConfig, normalizeProposalStudioConfig, reorderSection, toggleSection, setProposalMode, enabledSectionIds } from "./utils/proposalStudio.js";
import { ExplainDrawer, ExplainButton } from "./components/ExplainDrawer.jsx";
import {
  createBlankProject, createBlankLoads, buildProjectFromOnboarding, inferLoadAssessmentMode,
  PROJECT_OBJECTIVES, LOAD_SOURCES, getObjective, getLoadSource,
} from "./utils/projectFactory.js";
import {
  DEMO_PROJECTS, DEMO_DISCLAIMER, createProjectFromDemo, convertDemoToRealProject,
} from "./utils/demoProjects.js";
import {
  PROJECT_STAGES, STAGE_BOARD_COLUMNS, TASK_CATEGORIES, TASK_STATUSES, TASK_PRIORITIES,
  PROCUREMENT_STATUSES, ISSUE_SEVERITIES, ISSUE_STATUSES, APPROVAL_GATES,
  createDefaultDelivery, normalizeDelivery, getStage, getStageProgress, getChecklistProgress,
  summarizeDelivery, getBlockedItems, getNextActions, getStageGateWarnings,
  getProjectReadinessForStage, generateProcurementFromBoq, mergeProcurement,
  createTask, createIssue, createProcurementItem, getBoardColumn, getClientTimeline,
  getClientVisibleIssues, buildProcurementExportRows, procurementRowsToCsv,
} from "./utils/deliveryEngine.js";
import { calculateReadiness, computeAssumptionConfidence, computeGovernanceStatus } from "./utils/readiness.js";
import { generateAdvisory, generateClientExplanation, generateQuickWins } from "./utils/advisory.js";
import {
  calculateRoofGeometry,
  estimatePanelLayout,
  recommendPanelTiltAndOrientation,
  estimateRowSpacing,
  getInstallerTips,
  getRoofInstallationWarnings,
  getBlueprintConstructionAdvice,
} from "./utils/roofGeometry.js";
import {
  getInstallationSteps,
  getInverterAdvice,
  getBatteryAdvice,
  getCableEstimates,
  getSimulationWarnings,
  getBlueprintSimulationGuidance,
} from "./utils/installerSimulation.js";
import {
  generateStringPlan,
  compareAsBuilt,
  getStringColour,
  STRING_COLOURS,
  computePlanWarnings,
} from "./utils/stringPlanner.js";
import {
  distributeAcrossRoofFaces,
  computeFaceCapacity,
  getRoofFaceScore,
  createDefaultRoofFace,
  initRoofFacesFromSurvey,
  normalizeRoofFace,
  validateRoofFaces,
  summarizeRoofFaces,
} from "./utils/multiRoofLayout.js";
import {
  LOAD_MODES,
  getModeDefaults,
  getPresetsForMode,
  createLoadItem,
  computeItemDerived,
  summarizeLoads,
  toLegacyLoads,
  validateLoadItemsV2,
  BLUEPRINT_TEMPLATES,
  generateBlueprintDraftLoads,
  getLoadWarnings,
  getDataLoggerRecommendation,
  computeLoadProfile24h,
  STARTING_METHODS,
  calcMotorLoad,
  calcPumpingLoad,
  calcColdRoomLoad,
  calcHvacLoad,
  calcGeneratorHybrid,
  LOAD_PHASES,
  LOAD_SUPPLY_SCOPES,
  LOAD_CRITICALITIES,
  normalizeSupplyScope,
} from "./utils/loadEngine.js";
import {
  SCHEMA_VERSION,
  APP_VERSION,
  resolveLoadItemsV2,
  migrateLegacyLoadsToV2,
  normalizeLoadAssessmentMode,
  normalizeAccessoriesAssumptions,
  normalizeAccessoryOverrides,
  normalizeAccessoriesCatalogue,
  defaultAccessoriesAssumptions,
  generateProjectRef,
  normalizeProjectRef,
  normalizeCopilotHistory,
  normalizeCopilotLastReview,
  normalizeSizingMode,
  normalizeBlueprintAssumptions,
  normalizeQuoteStage,
  defaultBlueprintAssumptions,
  normalizeEnergyImport,
  normalizeViewMode,
} from "./utils/schemaMigration.js";
import {
  parseCsvText,
  autoDetectMapping,
  normalizeEnergyRows,
  cleanEnergyProfile,
  analyseLoadProfile,
  generateSizingFromLoadProfile,
  generateSyntheticLoads,
  buildEnergySurveyTemplateCsv,
  parseEnergySurveyRows,
  buildEnergyImportSummary,
} from "./utils/energyImportEngine.js";
import {
  loadProjectsLocal,
  saveProjectLocal,
  deleteProjectLocal,
  rememberLastActiveProject,
  findLastActiveProject,
  summarizeLocalData,
  clearLocalProjectData,
  exportAllLocalData,
  exportProjectJson,
  importProjectJson,
  loadFeedbackLocal,
  addFeedbackLocal,
  deleteFeedbackLocal,
  exportFeedbackJson,
  FEEDBACK_ISSUE_TYPES,
  CLOUD_STORAGE_CONFIGURED,
  PILOT_SAFETY_METADATA,
  isSafeModeRequested,
  getLocalProjectRecovery,
  quarantineLocalProjectRecord,
} from "./utils/projectStorage.js";
import { DEFAULT_CATALOGUE, CATALOGUE_CATEGORIES } from "./utils/catalogue.js";
import { generateAccessoriesBoQ, applyAccessoryOverrides } from "./utils/accessoryEngine.js";
import { useVoltflowPlatform } from "./platform/PlatformContext.jsx";
import { isTabAllowedForRole } from "./platform/accessControl.js";
import { prepareLegacyProjectMigration } from "./platform/legacyMigration.js";
import { createProjectVersionEnvelope } from "./platform/projectSnapshot.js";
import { reconcileBillAndLoads, billLoadClientMessage } from "./utils/billLoadReconciliation.js";
import { checksumEvidenceFile } from "./platform/evidenceAuthorization.js";
import { TRUST_FOUNDATION_VERSION } from "./platform/config.js";

const standardInverters = [1, 2, 3, 3.6, 5, 6, 8, 10, 12, 15, 20, 30, 50, 100];

const siteProfiles = {
  "Nairobi / Karen": {
    psh: 5.6,
    cellTemp: 47,
    soilingLoss: 0.04,
    minTemp: 7,
    altitude: 1795,
    monthlyPsh: [5.9, 6.1, 5.8, 5.4, 5.1, 4.8, 4.9, 5.2, 5.7, 5.8, 5.6, 5.8],
  },
  "Kiambu / Limuru": {
    psh: 5.3,
    cellTemp: 44,
    soilingLoss: 0.035,
    minTemp: 5,
    altitude: 2200,
    monthlyPsh: [5.6, 5.8, 5.5, 5.1, 4.8, 4.5, 4.6, 4.9, 5.4, 5.5, 5.3, 5.5],
  },
  "Machakos / Mua Hills": {
    psh: 5.9,
    cellTemp: 49,
    soilingLoss: 0.05,
    minTemp: 8,
    altitude: 1700,
    monthlyPsh: [6.2, 6.4, 6.1, 5.7, 5.4, 5.2, 5.3, 5.6, 6.0, 6.1, 5.9, 6.0],
  },
  "Mombasa / Coast": {
    psh: 5.8,
    cellTemp: 55,
    soilingLoss: 0.055,
    minTemp: 18,
    altitude: 50,
    monthlyPsh: [6.1, 6.2, 6.0, 5.7, 5.3, 5.0, 5.1, 5.4, 5.8, 6.0, 5.9, 6.1],
  },
  "Kisumu / Lake Region": {
    psh: 5.7,
    cellTemp: 53,
    soilingLoss: 0.05,
    minTemp: 14,
    altitude: 1130,
    monthlyPsh: [6.0, 6.1, 5.8, 5.5, 5.2, 5.0, 5.1, 5.4, 5.8, 5.9, 5.7, 5.9],
  },
  "Eldoret / Uasin Gishu": {
    psh: 5.4,
    cellTemp: 43,
    soilingLoss: 0.035,
    minTemp: 4,
    altitude: 2100,
    monthlyPsh: [5.7, 5.9, 5.6, 5.2, 4.9, 4.6, 4.7, 5.0, 5.5, 5.6, 5.4, 5.6],
  },
  "Nakuru / Naivasha": {
    psh: 5.8,
    cellTemp: 48,
    soilingLoss: 0.045,
    minTemp: 6,
    altitude: 1850,
    monthlyPsh: [6.1, 6.3, 6.0, 5.6, 5.3, 5.0, 5.1, 5.5, 5.9, 6.0, 5.8, 6.0],
  },
  "Garissa / Northern Kenya": {
    psh: 6.3,
    cellTemp: 58,
    soilingLoss: 0.07,
    minTemp: 12,
    altitude: 150,
    monthlyPsh: [6.6, 6.8, 6.5, 6.2, 5.9, 5.7, 5.8, 6.1, 6.4, 6.5, 6.3, 6.5],
  },
};

const batteryChemistries = {
  LFP: { label: "LFP / LiFePO4", dod: 0.87, efficiency: 0.94, cycleLife: 6000, replacementYear: 14, chargeC: 0.5, dischargeC: 1.0, bms: { ovp: "3.65V/cell", uvp: "2.50V/cell", chargeOtp: "45°C", dischargeOtp: "60°C", chargeUtp: "0°C" } },
  NMC: { label: "NMC Lithium", dod: 0.8, efficiency: 0.92, cycleLife: 4000, replacementYear: 10, chargeC: 0.5, dischargeC: 1.0, bms: { ovp: "4.20V/cell", uvp: "2.80V/cell", chargeOtp: "45°C", dischargeOtp: "60°C", chargeUtp: "0°C" } },
  VRLA: { label: "Lead-acid VRLA", dod: 0.5, efficiency: 0.82, cycleLife: 1200, replacementYear: 5, chargeC: 0.2, dischargeC: 0.3, bms: { ovp: "2.40V/cell charge limit", uvp: "1.85V/cell low cut", chargeOtp: "40°C", dischargeOtp: "50°C", chargeUtp: "5°C" } },
  FLOODED: { label: "Lead-acid Flooded", dod: 0.4, efficiency: 0.78, cycleLife: 900, replacementYear: 4, chargeC: 0.15, dischargeC: 0.25, bms: { ovp: "2.45V/cell charge limit", uvp: "1.80V/cell low cut", chargeOtp: "40°C", dischargeOtp: "50°C", chargeUtp: "5°C" } },
};

const evChargerSpecs = {
  L1: { label: "L1 - 3.7 kW home socket", kw: 3.7, standard: "IEC 62196 Type 2", notes: "Home / overnight charging. Minimal dedicated infrastructure.", unitCost: 85000 },
  L2: { label: "L2 - 7.4 kW AC wallbox", kw: 7.4, standard: "IEC 62196 Type 2", notes: "Office, hotel and retail charging. Most common practical Kenya setup.", unitCost: 180000 },
  DCFC50: { label: "DCFC - 50 kW fast charger", kw: 50, standard: "CCS2 / CHAdeMO", notes: "Highway corridors and busy commercial sites. Needs strong supply capacity.", unitCost: 2500000 },
  DCFC150: { label: "DCFC - 150 kW rapid charger", kw: 150, standard: "CCS2", notes: "Fleet depot or commercial hub. Dedicated MV transformer likely required.", unitCost: 7800000 },
  HPC350: { label: "HPC - 350 kW ultra-rapid charger", kw: 350, standard: "CCS2", notes: "Premium motorway hub. 11kV supply is likely required.", unitCost: 18000000 },
};

const carbonStandards = {
  VCS: {
    label: "VCS - Verra Verified Carbon Standard",
    registry: "Verra (verra.org)",
    creditingPeriodYr: 7,
    renewableEnergyMethodology: "AMS-I.D small-scale or ACM0002 large-scale",
    issuanceFee: 0.05,
    permanenceBuffer: 0.15,
    priceRangeUsd: { low: 5, mid: 12, high: 20 },
    additionality: "Standard investment analysis plus barriers test",
    kenyaGridNote: "Grid-tied solar faces additionality challenge given Kenya's renewable grid. Off-grid and diesel displacement have stronger cases.",
    verificationRequired: true,
  },
  GS: {
    label: "Gold Standard for the Global Goals",
    registry: "Gold Standard Foundation (goldstandard.org)",
    creditingPeriodYr: 10,
    renewableEnergyMethodology: "GS Grid-Connected Renewable Energy",
    issuanceFee: 0.05,
    permanenceBuffer: 0.1,
    priceRangeUsd: { low: 10, mid: 18, high: 30 },
    additionality: "Gold Standard ASER approved simplified additionality requirement",
    kenyaGridNote: "Gold Standard has co-benefits requirements and SDG alignment. Higher price but stricter process.",
    verificationRequired: true,
  },
  CDM: {
    label: "CDM - Clean Development Mechanism",
    registry: "UNFCCC CDM Registry",
    creditingPeriodYr: 10,
    renewableEnergyMethodology: "AMS-I.D Type I small-scale or ACM0002",
    issuanceFee: 0.02,
    permanenceBuffer: 0.05,
    priceRangeUsd: { low: 1, mid: 3, high: 6 },
    additionality: "CDM additionality tool plus investment test",
    kenyaGridNote: "CDM credits trade at very low prices. Not recommended for new projects; legacy use only.",
    verificationRequired: true,
  },
  Article6: {
    label: "Article 6 Paris Agreement - Bilateral / ITMO",
    registry: "UNFCCC Article 6 plus Kenya host country authorisation",
    creditingPeriodYr: 10,
    renewableEnergyMethodology: "Country-specific approved methodology",
    issuanceFee: 0.03,
    permanenceBuffer: 0.05,
    priceRangeUsd: { low: 15, mid: 30, high: 60 },
    additionality: "Host country authorisation required under Kenya NDC",
    kenyaGridNote: "Highest potential price but requires Kenya government authorisation. Complex process for bilateral buyers.",
    verificationRequired: true,
  },
  Internal: {
    label: "Internal / CSR - no tradeable registry credit",
    registry: "Internal company accounting only",
    creditingPeriodYr: 25,
    renewableEnergyMethodology: "GHG Protocol Scope 2 market-based reporting",
    issuanceFee: 0,
    permanenceBuffer: 0,
    priceRangeUsd: { low: 0, mid: 0, high: 0 },
    additionality: "Not required for internal reporting",
    kenyaGridNote: "For ESG or CSR reporting only. No tradeable credit is generated.",
    verificationRequired: false,
  },
};

const emissionFactors = {
  IPCC: { label: "IPCC Default (0.70 kg/kWh)", factor: 0.7, note: "Conservative worst-case for early feasibility. Not accurate for Kenya's low-carbon grid." },
  Kenya_National: { label: "Kenya National Inventory (0.37 kg/kWh)", factor: 0.37, note: "Kenya national inventory basis. Best for grid-connected projects seeking formal defensibility." },
  REREC: { label: "REREC / EPRA Average (0.40 kg/kWh)", factor: 0.4, note: "Kenya regulatory average. Useful for compliance and sector reporting." },
  Marginal: { label: "Marginal Emission Factor (0.55 kg/kWh)", factor: 0.55, note: "Represents displaced marginal thermal generation where justified by methodology." },
};

// v11.4.1 — CLEAN STARTUP. This is the neutral ENGINEERING baseline only: no
// client, no site, no bill. Demo data (including the former "Karen Homeowner"
// startup project) now lives in utils/demoProjects.js and loads only when the
// user explicitly picks it. The "Nairobi / Karen" SITE PROFILE above is real
// Kenya solar-resource data and remains selectable — it is unrelated to this.
const defaultProject = {
  client: "",
  location: "",
  preparedBy: "Solarise Engineer",
  systemType: "",
  phase: "",
  designStage: "Feasibility / Planning",
  siteProfile: "",
  monthlyBill: 0,
  solarCoverage: 0.85,
  selfConsumptionRate: 0.9,
  psh: 5.6,
  cellTemp: 47,
  minTemp: 7,
  altitude: 1795,
  temperatureCoeffPmax: -0.0035,
  tempCoeffVoc: -0.0028,
  soilingLoss: 0.04,
  lidLoss: 0.015,
  mismatchLoss: 0.02,
  shadingLoss: 0.02,
  dcCableLoss: 0.015,
  acCableLoss: 0.01,
  availabilityLoss: 0.02,
  inverterEfficiency: 0.96,
  panelW: 600,
  panelCost: 23000,
  panelArea: 2.58,
  moduleVoc: 49.9,
  moduleVmp: 41.8,
  moduleIsc: 15.2,
  moduleImp: 14.35,
  inverterMaxDcV: 1000,
  panelsPerString: 12,
  dcCableLengthM: 30,
  dcCableSizeMm2: 6,
  acCableLengthM: 25,
  acCableSizeMm2: 10,
  acVoltage: 230,
  gensetRatedKva: 10,
  gensetFuelLPerHour: 3.5,
  gensetFuelCostKes: 180,
  gensetRunHoursPerDay: 6,
  gensetMaintenanceCostYr: 45000,
  gensetAgeYears: 3,
  gensetLifeYears: 15,
  evChargerType: "L2",
  evChargersTotal: 4,
  evPeakSimultaneous: 2,
  evDailyChargingHours: 6,
  evOccupancy: 0.65,
  evTariffKes: 35,
  evGridConnectionKva: 100,
  mgHouseholds: 50,
  mgCommercialCustomers: 5,
  mgAnchorLoad: 0,
  mgHouseholdLoadKwh: 1.5,
  mgCommercialLoadKwh: 8.0,
  mgResidentialTariff: 45,
  mgCommercialTariff: 55,
  mgAnchorTariff: 30,
  mgConnectionFee: 5000,
  mgOpexPerSubscriberYr: 1200,
  mgCapexDistribution: 350000,
  batteryChemistry: "LFP",
  batteryVoltage: 48,
  backupHours: 10,
  autonomyDays: 1.5,
  dod: 0.87,
  batteryEfficiency: 0.94,
  batteryModuleKwh: 5.12,
  batteryModuleCost: 72000,
  inverterHeadroom: 1.25,
  // v11.6 — calculation coherence: explicit sizing basis + load diversity
  inverterSizingBasis: "auto_engineering", // auto_engineering | backup_peak_led | pv_ratio_led | manual_review
  runningLoadDiversityFactor: DEFAULT_RUNNING_DIVERSITY, // 0.75
  surgeDiversityFactor: DEFAULT_SURGE_DIVERSITY,         // 0.65
  manualInverterKw: 0,
  inverterUnitCost: 145000,
  mountingPerPanel: 4750,
  monitoringCost: 20100,
  cablingProtectionCost: 46150,
  epcCost: 108000,
  contingency: 0.05,
  vat: 0.16,
  gridTariff: 22,
  electricityTariff: null,
  tariffEscalation: 0.08,
  discountRate: 0.12,
  projectLife: 25,
  degradation: 0.005,
  p90Factor: 0.9,
  co2Factor: 0.7,
  carbonPrice: 1500,
  carbonStandard: "VCS",
  emissionFactorSource: "Kenya_National",
  carbonCreditingPeriod: 7,
  carbonVerificationFrequency: 2,
  carbonVerificationCostKes: 800000,
  carbonMrvCostKes: 150000,
  carbonPermanenceBuffer: 0.15,
  carbonIssuanceFee: 0.05,
  carbonPriceUsd: 12,
  usdKesRate: 130,
  carbonPriceScenario: "Base",
  carbonEscalation: 0.03,
  inflationRate: 0.06,
  oAndMRate: 0.01,
  debtShare: 0.0,
  loanInterest: 0.12,
  loanTerm: 5,
  capSavingsToBill: true,
  carbonInCashflow: false,
  // Genset savings refinement (Phase 5)
  gensetSolarDirectDisplacement: 0.65,
  gensetBatteryTimeShiftDisplacement: 0.15,
  gensetMinimumRuntimeHours: 2,
  // EV battery buffer (Phase 4)
  evBatteryBufferEnabled: false,
  evPeakBufferHours: 1,
  evBatteryReserveFraction: 0.2,
  // v8 — Assumption quality sources
  billSource: "client_estimate",
  loadSource: "estimated",
  pricingSource: "default",
  // v8.3 — Panel dimensions and roof layout
  panelLengthM: 2.28,
  panelWidthM: 1.13,
  roofEdgeSetbackM: 0.3,
  roofWalkwayAllowanceM: 0.6,
  mountingOrientation: "auto",  // portrait | landscape | auto
  roofUsablePercent: 0.70,
  // v8.5 — MPPT / string planner inputs
  inverterMpptCount:      2,
  inverterStringsPerMppt: 2,
  // v8.3 — Blueprint / new-build mode (v11.1: three-way sizing basis + assumptions)
  sizingMode: "existing_site",    // existing_site | blueprint_new_build | future_expansion
  blueprint: { ...defaultBlueprintAssumptions },
  quoteStage: "auto",             // auto | Sent | Won | Lost (manual pipeline override)
  viewMode: "engineer",           // v11.4 presentation mode: engineer | client | technician
  delivery: null,                 // v11.5 Voltflow Delivery — created on project activation
  borehole: createDefaultBorehole(), // v11.6 Solar Borehole & Water Pumping specialist module
  evidence: createDefaultEvidence(),        // v11.7 canonical project evidence record
  compliance: createDefaultCompliance(),    // v11.7 Kenya-first compliance workspace
  pilotEvidence: createDefaultPilotEvidence(), // v11.7 measurable pilot KPIs
  // v11.7 Voltflow Studio persisted state
  selectedTemplateId: null,
  selectedScenarioId: null,
  proposalStudioConfig: createDefaultProposalStudioConfig(),
  assetSelections: [],
  inventoryLinks: {},
  batterySelection: { selection_mode: "AUTO", asset_id: null, quantity: 0, override_reason: null, selected_by: null, selected_at: null },
  inverterSelection: { selection_mode: "AUTO", asset_id: null },
  designRevision: null,
  selectedDesignOption: null,
  quoteCurrency: "KES",
  pricingPolicyVersion: "VF-11.8-01",
  taxRuleVersion: "KE-2026-01",
  studioProgress: 0,
  // v11.7.1 Bank Pilot Mode
  bankPilotSubmitted: false,
  bankPilotSubmittedAt: null,
  pilotSafetyAcknowledged: false,
  blueprintRoofLengthM: 0,
  blueprintRoofWidthM: 0,
  blueprintRoofPitchDeg: 15,
  blueprintRoofOrientationDeg: 180,
  blueprintScaleFactor: 1,
  roofDrawingConfidence: "estimated",
};

// v11.4.1 — the app starts with an EMPTY load table. Sample household loads
// moved to utils/demoProjects.js (Residential Hybrid Demo).
const defaultLoads = [];

const countyToSiteProfile = {
  Nairobi: "Nairobi / Karen",
  Kiambu: "Kiambu / Limuru",
  Machakos: "Machakos / Mua Hills",
  Mombasa: "Mombasa / Coast",
  Kwale: "Mombasa / Coast",
  Kilifi: "Mombasa / Coast",
  Kisumu: "Kisumu / Lake Region",
  "Uasin Gishu": "Eldoret / Uasin Gishu",
  Nakuru: "Nakuru / Naivasha",
  Naivasha: "Nakuru / Naivasha",
  Garissa: "Garissa / Northern Kenya",
  Turkana: "Garissa / Northern Kenya",
  Marsabit: "Garissa / Northern Kenya",
};

const defaultSurvey = {
  clientName: "",
  phone: "",
  email: "",
  siteAddress: "",
  county: "",            // v11.4.1 — no assumed county on a clean start
  siteType: "Residential",
  surveyDate: new Date().toISOString().split("T")[0],
  surveyor: "",
  roofType: "Mabati / Iron sheet",
  roofCondition: "Good",
  roofLengthM: 12,
  roofWidthM: 8,
  roofAreaM2: 67,
  roofMeasurementSource: "estimated",
  roofPitch: 15,
  orientation: "South",
  roofAzimuthDeg: 180,
  roofUsablePercent: 0.70,
  // v8.3 — roof input mode
  roofInputMode: "manual_dimensions", // manual_dimensions | gps_coordinates | blueprint_dimensions | satellite_estimate
  // GPS corners (for gps_coordinates mode)
  gpsCornerA: { lat: "", lng: "" },
  gpsCornerB: { lat: "", lng: "" },
  gpsCornerC: { lat: "", lng: "" },
  gpsCornerD: { lat: "", lng: "" },
  // Blueprint dimensions (for blueprint_dimensions mode)
  blueprintRoofLengthM: 0,
  blueprintRoofWidthM: 0,
  blueprintScaleFactor: 1,
  blueprintPitchDeg: 15,
  blueprintOrientationDeg: 180,
  blueprintObstructionPct: 0.15,
  // Satellite
  satelliteVerified: false,
  shadingSources: [],
  kplcActive: true,
  meterNumber: "",
  phaseType: "",   // v11.5.1 BUG-1 fix — no assumed phase; the wizard/Project Setup choice must win, not a survey default
  mainBreakerA: 60,
  dbCondition: "Good",
  spareBreakerSpace: "Yes — 2 spaces",
  earthingAvailable: true,
  monthlyBill: 0,
  existingGenerator: false,
  existingInverter: false,
  wiringCondition: "Good",
  photos: {},
  siteNotes: "",
  clientObjectives: [],
};

const defaultSimulation = {
  // ── Equipment locations (v8.4) ──
  dbLocation:         "bottom-left",
  inverterLocation:   "indoor_utility",
  batteryLocation:    "near_inverter",
  meterLocation:      "front_wall",
  cableEntryPoint:    "bottom",
  dcRouteCustomM:     0,
  acRouteCustomM:     0,
  batteryRouteCustomM: 0,
  obstructions:       [],
  installationChecklist: Array(19).fill(false),

  // ── v8.5: Accessory placement ──
  dcIsolatorLocation:   "near_array",   // near_array | under_eaves | near_inverter | custom
  dcSpdLocation:        "near_inverter",
  combinerLocation:     "near_array",
  earthPointLocation:   "near_array",

  // ── v8.5: Multi-roof faces ──
  // Empty = use primary survey roof. Populated when user adds faces.
  roofFaces:            [],             // [{id, name, roofLengthM, roofWidthM, ...}]
  activeRoofFaceId:     null,

  // ── v8.5: Layout mode ──
  layoutMode:           "auto",         // auto | assisted_manual
  manualRemovedPanels:  [],             // [{roofFaceId, col, row}] panels removed in manual mode
  selectedPanelKey:     null,           // "roofFaceId:col:row" of currently selected panel

  // ── v8.5: String plan (null = not yet generated) ──
  stringPlan:           null,

  // ── v8.5: As-built handover ──
  asBuilt: {
    enabled:                     false,
    actualPanelsInstalled:       0,
    actualPanelOrientation:      "portrait",
    actualInverterLocation:      "",
    actualBatteryLocation:       "",
    actualDcCableLengthM:        0,
    actualAcCableLengthM:        0,
    actualBatteryCableLengthM:   0,
    measuredVoc:                 [],    // one per string
    measuredIsc:                 [],    // one per string
    actualEarthingContinuityPass:  false,
    actualInsulationResistancePass: false,
    monitoringConfigured:          false,
    clientHandoverCompleted:       false,
    installerName:                 "",
    commissioningDate:             "",
    asBuiltNotes:                  "",
  },

  // ── v8.5: UI toggles ──
  technicianView:       false,
};

const INSTALLATION_STEP_COUNT = 19;
const MAX_ENERGY_IMPORT_BYTES = 10 * 1024 * 1024;
const MAX_ENERGY_IMPORT_ROWS = 100000;

function normalizeChecklist(raw) {
  const base = Array(INSTALLATION_STEP_COUNT).fill(false);
  if (Array.isArray(raw)) raw.forEach((v, i) => { if (i < INSTALLATION_STEP_COUNT) base[i] = !!v; });
  return base;
}

/**
 * Backfill a simulation object loaded from a saved/imported project — which may
 * predate v8.4/v8.5 fields, or be entirely absent — with current defaults, and
 * guard nested objects/arrays against corruption or partial shape.
 */
function normalizeSimulation(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const stringPlanValid = r.stringPlan && Array.isArray(r.stringPlan.strings);
  return {
    ...defaultSimulation,
    ...r,
    obstructions:          Array.isArray(r.obstructions)        ? r.obstructions        : [],
    installationChecklist: normalizeChecklist(r.installationChecklist),
    roofFaces:              Array.isArray(r.roofFaces)            ? r.roofFaces.map((face, index) => normalizeRoofFace({ ...(face && typeof face === "object" ? face : {}), id: face?.id || `face_migrated_${index + 1}` })) : [],
    manualRemovedPanels:   Array.isArray(r.manualRemovedPanels)  ? r.manualRemovedPanels  : [],
    stringPlan:            stringPlanValid ? r.stringPlan : null,
    asBuilt: {
      ...defaultSimulation.asBuilt,
      ...(r.asBuilt && typeof r.asBuilt === "object" ? r.asBuilt : {}),
      measuredVoc: Array.isArray(r.asBuilt?.measuredVoc) ? r.asBuilt.measuredVoc : [],
      measuredIsc: Array.isArray(r.asBuilt?.measuredIsc) ? r.asBuilt.measuredIsc : [],
    },
  };
}

/** Backfill a survey object loaded from a saved/imported project with current defaults. */
function normalizeSurvey(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    ...defaultSurvey,
    ...r,
    shadingSources:   Array.isArray(r.shadingSources)   ? r.shadingSources   : [],
    clientObjectives: Array.isArray(r.clientObjectives) ? r.clientObjectives : [],
    photos:           r.photos && typeof r.photos === "object" ? r.photos : {},
  };
}

/**
 * Single source of truth for turning a saved-project record (from local
 * storage or an imported JSON file) into the app's state shapes. Used by
 * both "Load" and "Import JSON" so the two paths can't diverge, and so every
 * load — even of projects saved before v8.4/v8.5 introduced the simulation
 * studio, or before v10 introduced loadItemsV2/accessories — produces a
 * fully-shaped, non-crashing state instead of silently leaving the previous
 * project's data on screen.
 */
function normalizeLoadedRecord(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const normalizedProjectRef = normalizeProjectRef(r.projectRef, r);
  const mergedProject = { ...defaultProject, ...(r.project && typeof r.project === "object" ? r.project : {}) };
  mergedProject.sizingMode = normalizeSizingMode(mergedProject.sizingMode);
  mergedProject.blueprint  = normalizeBlueprintAssumptions(mergedProject.blueprint);
  mergedProject.quoteStage = normalizeQuoteStage(mergedProject.quoteStage);
  mergedProject.energyImport = normalizeEnergyImport(mergedProject.energyImport);
  mergedProject.electricityTariff = normalizeTariffState(mergedProject.electricityTariff);
  mergedProject.viewMode = normalizeViewMode(mergedProject.viewMode);
  // v11.5 — Voltflow Delivery. Old projects have no delivery object; they get a
  // default one (stage "lead") so every delivery screen renders safely.
  mergedProject.delivery = mergedProject.delivery
    ? normalizeDelivery(mergedProject.delivery, mergedProject)
    : createDefaultDelivery(mergedProject, {}, [], {
      stableIdPrefix: normalizedProjectRef,
      timestamp: r.savedAt || r.exportedAt || null,
    });
  // v11.6 — Solar Borehole module + inverter-coherence fields. Old projects get
  // safe defaults so every borehole/inverter screen renders without error.
  mergedProject.borehole = normalizeBorehole(mergedProject.borehole);
  // v11.7 — evidence record, compliance workspace, pilot KPIs (old projects → defaults)
  mergedProject.evidence = normalizeEvidence(mergedProject.evidence);
  mergedProject.compliance = normalizeCompliance(mergedProject.compliance);
  mergedProject.pilotEvidence = normalizePilotEvidence(mergedProject.pilotEvidence);
  // v11.7 — Voltflow Studio persisted state (old projects → safe defaults)
  mergedProject.proposalStudioConfig = normalizeProposalStudioConfig(mergedProject.proposalStudioConfig);
  mergedProject.assetSelections = normalizeAssetSelections(mergedProject.assetSelections);
  mergedProject.batterySelection = normalizeBatterySelection(mergedProject.batterySelection);
  mergedProject.equipmentSelection = normalizeEquipmentSelection(mergedProject.equipmentSelection);
  Object.assign(mergedProject, resolveEquipmentProject(mergedProject));
  mergedProject.inventoryLinks = mergedProject.inventoryLinks && typeof mergedProject.inventoryLinks === "object" ? mergedProject.inventoryLinks : {};
  mergedProject.designRevision = mergedProject.designRevision && typeof mergedProject.designRevision === "object" ? mergedProject.designRevision : null;
  mergedProject.selectedDesignOption = mergedProject.selectedDesignOption && typeof mergedProject.selectedDesignOption === "object" ? mergedProject.selectedDesignOption : null;
  if (typeof mergedProject.selectedTemplateId !== "string") mergedProject.selectedTemplateId = mergedProject.selectedTemplateId || null;
  if (typeof mergedProject.selectedScenarioId !== "string") mergedProject.selectedScenarioId = mergedProject.selectedScenarioId || null;
  if (!Number.isFinite(Number(mergedProject.studioProgress))) mergedProject.studioProgress = 0;
  mergedProject.bankPilotSubmitted = !!mergedProject.bankPilotSubmitted; // v11.7.1
  mergedProject.pilotSafetyAcknowledged = !!mergedProject.pilotSafetyAcknowledged; // v11.7.2
  if (!INVERTER_BASES.includes(mergedProject.inverterSizingBasis)) mergedProject.inverterSizingBasis = "auto_engineering";
  if (!(Number(mergedProject.runningLoadDiversityFactor) > 0)) mergedProject.runningLoadDiversityFactor = DEFAULT_RUNNING_DIVERSITY;
  if (!(Number(mergedProject.surgeDiversityFactor) > 0)) mergedProject.surgeDiversityFactor = DEFAULT_SURGE_DIVERSITY;
  return {
    project:             mergedProject,
    survey:              normalizeSurvey(r.survey),
    simulation:          normalizeSimulation(r.simulation),
    loadAssessmentMode:  normalizeLoadAssessmentMode(r.loadAssessmentMode),
    loadItemsV2:         resolveLoadItemsV2(r) || migrateLegacyLoadsToV2(defaultLoads),
    accessoriesAssumptions: normalizeAccessoriesAssumptions(r.accessoriesAssumptions),
    accessoryOverrides:     normalizeAccessoryOverrides(r.accessoryOverrides),
    accessoriesCatalogue:   normalizeAccessoriesCatalogue(r.accessoriesCatalogue, DEFAULT_CATALOGUE),
    projectRef:             normalizedProjectRef,
    copilotHistory:         normalizeCopilotHistory(r.copilotHistory),
    copilotLastReview:      normalizeCopilotLastReview(r.copilotLastReview),
  };
}

const nf = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 2 });
const money = (v) => `KES ${nf.format(Number.isFinite(v) ? v : 0)}`;
const pct = (v) => `${nf1.format((Number.isFinite(v) ? v : 0) * 100)}%`;
const num = (v, d = 1) => (d === 0 ? nf.format(v || 0) : d === 2 ? nf2.format(v || 0) : nf1.format(v || 0));
const clamp = (v, min, max) => Math.min(Math.max(Number(v) || 0, min), max);
const LOAD_PENDING_LABEL = "Pending load inventory";
const LOAD_INVALID_LABEL = "Invalid load inventory";
const SURVEY_ASSUMPTION_NOTE = "Assumption — confirm during site survey.";
// IEC 60228 copper resistivity at 75°C operating temperature (ρ₂₀ × (1 + 0.00393 × 55) ≈ 0.0213 Ω·mm²/m)
const copperResistivity = 0.0213;
const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function hasInvalidLoadHours(loads = []) {
  return (Array.isArray(loads) ? loads : []).some((l) => (Number(l?.dayHours) || 0) + (Number(l?.nightHours) || 0) > 24);
}

function withSurveyAssumption(key, display, survey = {}) {
  const assumed =
    key === "roofCondition" ? String(survey.roofCondition || "") === String(defaultSurvey.roofCondition) :
    key === "roofAreaM2" ? (survey.roofMeasurementSource || "estimated") === "estimated" || Number(survey.roofAreaM2) === Number(defaultSurvey.roofAreaM2) :
    key === "mainBreakerA" ? Number(survey.mainBreakerA) === Number(defaultSurvey.mainBreakerA) :
    key === "earthingAvailable" ? survey.earthingAvailable === defaultSurvey.earthingAvailable :
    false;
  return assumed ? `${display} (${SURVEY_ASSUMPTION_NOTE})` : display;
}

function applyLoadInventoryGate(result, reason) {
  const zeroFields = [
    "connectedW", "dayKwh", "nightKwh", "dailyKwh", "designDailyKwh", "criticalDayKwh", "criticalNightKwh", "criticalDailyKwh",
    "targetDailyKwh", "requiredKwp", "panels", "actualKwp", "dailySolarKwh", "annualEnergy", "annualEnergyP90", "specificYield", "roofArea",
    "backupEnergyNeed", "requiredBatteryKwh", "batteryModules", "batteryKwh", "usableBatteryKwh", "autonomyHours",
    "peakKw", "loadBasedInvKw", "pvBasedInvKw", "engineeringMinInvKw", "inverterKw", "dcAcRatio",
    "pvCost", "mountingCost", "inverterCost", "batteryCost", "subtotalBeforeContingency", "contingencyAmount", "subtotal", "vatAmount", "totalCost", "investmentCost",
    "uncappedAnnualSavings", "annualSavings", "annualSavingsP90", "monthlySavings", "annualOM", "annualNet", "annualNetP90",
    "debtPrincipal", "equityRequired", "annualDebtService", "dscrYear1", "npv10", "npvLife", "equityNpvLife", "irrLife", "equityIrr",
    "lcoe", "lcoeP90", "lcoeReal", "lcoeP90Real", "discountedLcoe", "discountedLcoeP90",
    "carbonOffset", "carbonOffsetP90", "carbonValue", "grossCarbonRevenue", "netCarbonRevenue", "annualNetCarbonRevenue",
    "paybackP10", "paybackP50MonteCarlo", "paybackP90MonteCarlo", "specialistCapex",
  ];
  const gated = { ...result };
  zeroFields.forEach((key) => { gated[key] = 0; });
  gated.quote = {
    currency: result.quote?.currency || "KES", lines: [], category_totals: {}, discount: 0,
    subtotal_net: 0, tax: 0, total_gross: 0, tax_breakdown: [],
    pricing_policy_version: result.quote?.pricing_policy_version || null,
    tax_rule_version: result.quote?.tax_rule_version || null,
  };
  gated.payback = Infinity;
  gated.paybackP90 = Infinity;
  gated.breakEvenYear = null;
  gated.annualRows = [];
  gated.monthlyYieldRows = [];
  gated.quoteReady = false;
  gated.loadInventoryBlocked = true;
  gated.loadInventoryPending = reason === LOAD_PENDING_LABEL;
  gated.loadInventoryInvalid = reason === LOAD_INVALID_LABEL;
  gated.quoteBlockedReason = reason;
  gated.inverterSizing = { ...(result.inverterSizing || {}), selectedInverterKw: 0, selectedReason: reason, peakKw: 0, loadBasedInvKw: 0, pvBasedInvKw: 0, engineeringMinInvKw: 0 };
  gated.dcAcAnalysis = { ...(result.dcAcAnalysis || {}), ratio: 0, status: reason, severity: "blocked" };
  gated.stringSizing = { ...(result.stringSizing || {}), effectivePanelsPerString: 0, totalStrings: 0, note: reason };
  gated.warnings = [`${reason} - add committed loads and click Update Sizing before pricing.`, ...(result.warnings || []).filter((w) => !/load inventory/i.test(String(w)))];
  return gated;
}

function nextStandard(value, list = standardInverters) {
  return list.find((x) => x >= value) ?? list[list.length - 1];
}

function npv(rate, cashflows) {
  return cashflows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + rate, i), 0);
}

function irr(cashflows, guess = 0.2) {
  if (!cashflows.some(value => value > 0) || !cashflows.some(value => value < 0)) return null;
  let rate = guess;
  for (let i = 0; i < 80; i++) {
    let f = 0;
    let df = 0;
    cashflows.forEach((cf, t) => {
      f += cf / Math.pow(1 + rate, t);
      if (t > 0) df -= (t * cf) / Math.pow(1 + rate, t + 1);
    });
    if (Math.abs(df) < 1e-9) break;
    const next = rate - f / df;
    if (!Number.isFinite(next) || next <= -0.99) break;
    if (Math.abs(next - rate) < 1e-7 && Math.abs(npv(next, cashflows)) <= Math.max(0.01, Math.abs(cashflows[0]) * 1e-8)) return next;
    rate = next;
  }
  return null;
}

function annualPayment(principal, annualRate, years) {
  if (principal <= 0 || years <= 0) return 0;
  if (annualRate <= 0) return principal / years;
  return (principal * annualRate) / (1 - Math.pow(1 + annualRate, -years));
}

function loadEnergy(load, key) {
  return (load.qty * load.watts * (Number(load[key]) || 0)) / 1000;
}

function computedPerformanceRatio(project) {
  const tempLoss = Math.max(0, (project.cellTemp - 25) * Math.abs(project.temperatureCoeffPmax));
  const lossFactors = [
    tempLoss,
    project.soilingLoss,
    project.lidLoss,
    project.mismatchLoss,
    project.shadingLoss,
    project.dcCableLoss,
    project.acCableLoss,
    project.availabilityLoss,
  ];
  const afterLosses = lossFactors.reduce((acc, loss) => acc * (1 - clamp(loss, 0, 0.4)), 1);
  return clamp(afterLosses * clamp(project.inverterEfficiency, 0.75, 0.99), 0.45, 0.95);
}

// ─── Lightweight option sizing (for System Options comparison cards) ────────────
function computeOptionSizingLegacyUnused(proj, loads) {
  const pr           = computedPerformanceRatio(proj);
  const isEV         = proj.systemType === "EV charging";
  const isMG         = proj.systemType === "Mini-grid";
  const isOff        = proj.systemType === "Off-grid";
  const evSp         = evChargerSpecs[proj.evChargerType] || evChargerSpecs.L2;
  const evDailyKwh   = isEV ? evSp.kw * proj.evChargersTotal * proj.evDailyChargingHours * proj.evOccupancy : 0;
  const mgDailyKwh   = isMG ? proj.mgHouseholds * proj.mgHouseholdLoadKwh + proj.mgCommercialCustomers * proj.mgCommercialLoadKwh : 0;
  const dayKwh       = loads.reduce((s, l) => s + (l.qty * l.watts * (l.dayHours || 0)) / 1000, 0);
  const nightKwh     = loads.reduce((s, l) => s + (l.qty * l.watts * (l.nightHours || 0)) / 1000, 0);
  const dailyKwh     = isEV ? evDailyKwh : isMG ? mgDailyKwh : dayKwh + nightKwh;
  const critDailyKwh = loads.filter(l => l.critical).reduce((s, l) => s + (l.qty * l.watts * ((l.dayHours || 0) + (l.nightHours || 0))) / 1000, 0);
  const optionLoadInvalid = hasInvalidLoadHours(loads);
  const optionLoadPending = (Array.isArray(loads) ? loads.length : 0) === 0 || dailyKwh <= 0;
  if (optionLoadInvalid || optionLoadPending) {
    return {
      pr, panels: 0, actualKwp: 0, battKwh: 0, battModules: 0, invKw: 0,
      totalCost: 0, annualSavings: 0, annualNet: 0, payback: Infinity, autonomyH: 0, dailyKwh: 0,
      loadInventoryPending: optionLoadPending,
      loadInventoryInvalid: optionLoadInvalid,
      loadInventoryBlocked: true,
      quoteReady: false,
      quoteBlockedReason: optionLoadInvalid ? LOAD_INVALID_LABEL : LOAD_PENDING_LABEL,
      warnings: [`${optionLoadInvalid ? LOAD_INVALID_LABEL : LOAD_PENDING_LABEL} - add committed loads and click Update Sizing before pricing.`],
    };
  }

  // PV
  const targetKwh = dailyKwh * proj.solarCoverage;
  const reqKwp    = targetKwh / Math.max(proj.psh * pr, 0.1);
  const panels    = Math.max(1, Math.ceil(reqKwp * 1000 / proj.panelW));
  const actualKwp = panels * proj.panelW / 1000;
  const annualEnergy = actualKwp * proj.psh * pr * 365;

  // Battery
  const backupNeed   = (isOff || isMG) ? dailyKwh * proj.autonomyDays : critDailyKwh * (proj.backupHours / 24);
  const reqBattKwh   = backupNeed / Math.max(proj.dod * proj.batteryEfficiency, 0.1);
  const battModules  = Math.max(1, Math.ceil(reqBattKwh / proj.batteryModuleKwh));
  const battKwh      = battModules * proj.batteryModuleKwh;
  const usableKwh    = battKwh * proj.dod * proj.batteryEfficiency;
  const backupRefKw  = backupNeed / Math.max((isOff || isMG) ? 24 * proj.autonomyDays : proj.backupHours, 1);
  const autonomyH    = backupRefKw > 0 ? usableKwh / backupRefKw : 0;

  // Inverter
  const surgeKw = loads.reduce((s, l) => s + (l.qty * l.watts * Math.max(l.surge || 1, 1)) / 1000, 0);
  // v11.6 — apply the same load-diversity factors as the main engine so option
  // cards and the main design agree on inverter size.
  const runningDiv = Number(proj.runningLoadDiversityFactor) > 0 ? proj.runningLoadDiversityFactor : 0.75;
  const surgeDiv   = Number(proj.surgeDiversityFactor) > 0 ? proj.surgeDiversityFactor : 0.65;
  const peakKw  = Math.max((loads.reduce((s, l) => s + l.qty * l.watts, 0) / 1000) * runningDiv, surgeKw * surgeDiv);
  const invMin  = Math.max(peakKw * proj.inverterHeadroom, actualKwp * 1.1);
  const invKw   = nextStandard(invMin);

  // Cost — include genset ATS cost for Genset hybrid so options match main useSizing
  const pvCost        = panels * proj.panelCost;
  const mountCost     = panels * proj.mountingPerPanel;
  const battCost      = battModules * proj.batteryModuleCost + 16000;
  const gensetAtsCost = proj.systemType === "Genset hybrid" ? 85000 : 0;
  const subtotal      = pvCost + mountCost + proj.inverterUnitCost + battCost
                        + proj.monitoringCost + proj.cablingProtectionCost + proj.epcCost
                        + gensetAtsCost;
  const totalCost     = subtotal * (1 + proj.contingency) * (1 + proj.vat);

  // Financials — respect capSavingsToBill flag, same as main useSizing
  const uncappedSavings = annualEnergy * proj.selfConsumptionRate * proj.gridTariff;
  const billLimit       = proj.monthlyBill * 12 * proj.solarCoverage;
  const annualSavings   = proj.capSavingsToBill ? Math.min(uncappedSavings, billLimit) : uncappedSavings;
  const annualOM    = totalCost * proj.oAndMRate;
  const annualNet   = annualSavings - annualOM;
  const payback     = annualNet > 0 ? totalCost / annualNet : Infinity;

  return { pr, panels, actualKwp, battKwh, battModules, invKw, totalCost, annualSavings, annualNet, payback, autonomyH, dailyKwh };
}

// Project persistence lives in utils/projectStorage.js (v11.3) — one home for
// local storage today and the cloud backend later.

function useSizing(projectInput, loads) {
  return useMemo(() => {
    const project = resolveEquipmentProject(projectInput);
    const pr = computedPerformanceRatio(project);
    const connectedW = loads.reduce((s, l) => s + l.qty * l.watts, 0);
    const dayKwh = loads.reduce((s, l) => s + loadEnergy(l, "dayHours"), 0);
    const nightKwh = loads.reduce((s, l) => s + loadEnergy(l, "nightHours"), 0);
    const dailyKwh = dayKwh + nightKwh;
    const evSizingSpec = evChargerSpecs[project.evChargerType] || evChargerSpecs.L2;
    const evSizingDailyKwh = project.systemType === "EV charging" ? evSizingSpec.kw * project.evChargersTotal * project.evDailyChargingHours * project.evOccupancy : 0;
    const mgSizingHouseholdKwh = project.systemType === "Mini-grid" ? project.mgHouseholds * project.mgHouseholdLoadKwh : 0;
    const mgSizingCommercialKwh = project.systemType === "Mini-grid" ? project.mgCommercialCustomers * project.mgCommercialLoadKwh : 0;
    const mgSizingAnchorKwh = project.systemType === "Mini-grid" ? project.mgAnchorLoad * 12 : 0;
    const mgSizingCommunityDailyKwh = mgSizingHouseholdKwh + mgSizingCommercialKwh + mgSizingAnchorKwh;
    const designDailyKwh = project.systemType === "EV charging" ? evSizingDailyKwh : project.systemType === "Mini-grid" ? mgSizingCommunityDailyKwh : dailyKwh;
    const loadInventoryInvalid = hasInvalidLoadHours(loads);
    const loadInventoryPending = (Array.isArray(loads) ? loads.length : 0) === 0 || designDailyKwh <= 0;
    const loadInventoryBlocked = loadInventoryPending || loadInventoryInvalid;
    const quoteBlockedReason = loadInventoryInvalid ? LOAD_INVALID_LABEL : loadInventoryPending ? LOAD_PENDING_LABEL : null;
    const criticalDayKwh = loads.filter((l) => l.critical).reduce((s, l) => s + loadEnergy(l, "dayHours"), 0);
    const criticalNightKwh = loads.filter((l) => l.critical).reduce((s, l) => s + loadEnergy(l, "nightHours"), 0);
    const criticalDailyKwh = criticalDayKwh + criticalNightKwh;
    const runningKw = connectedW / 1000;
    const surgeKw = loads.reduce((s, l) => s + (l.qty * l.watts * Math.max(l.surge || 1, 1)) / 1000, 0);
    // v11.6 — peakKw now comes from the coherence engine (applies load diversity);
    // computed with the inverter block below.

    const targetDailyKwh = designDailyKwh * project.solarCoverage;
    const requiredKwp = targetDailyKwh / Math.max(project.psh * pr, 0.1);
    const panels = equipmentPanelCount(project, Math.max(1, Math.ceil((requiredKwp * 1000) / project.panelW)));
    const actualKwp = (panels * project.panelW) / 1000;
    const dailySolarKwh = actualKwp * project.psh * pr;
    const annualEnergy = dailySolarKwh * 365;
    const annualEnergyP90 = annualEnergy * project.p90Factor;
    const specificYield = annualEnergy / actualKwp;
    const roofArea = panels * project.panelArea;

    const monthlyPshData = siteProfiles[project.siteProfile]?.monthlyPsh ?? [];
    const worstMonthPsh = monthlyPshData.length ? Math.min(...monthlyPshData) : project.psh;
    const worstMonthIndex = monthlyPshData.indexOf(worstMonthPsh);
    const worstMonthName = worstMonthIndex >= 0 ? monthLabels[worstMonthIndex] : "N/A";
    const monthlyYieldRows = monthlyPshData.map((monthPsh, index) => ({
      month: monthLabels[index],
      psh: monthPsh,
      energyKwh: actualKwp * monthPsh * pr * 30,
      coverage: designDailyKwh > 0 ? (actualKwp * monthPsh * pr) / designDailyKwh : 0,
      isWorstMonth: monthPsh === worstMonthPsh,
    }));
    const worstMonthEnergy = actualKwp * worstMonthPsh * pr * 30;
    const worstMonthLoad = designDailyKwh * 30;
    const offgridWorstMonthCoverage = worstMonthLoad > 0 ? worstMonthEnergy / worstMonthLoad : 0;
    const offgridWorstMonthOk = offgridWorstMonthCoverage >= 0.9;

    // Phase 4: EV battery buffer for peak shaving (uses evSizingSpec which is declared above)
    const evBatteryBufferKwh = project.systemType === "EV charging" && project.evBatteryBufferEnabled
      ? (evSizingSpec.kw * project.evPeakSimultaneous * (project.evPeakBufferHours ?? 1))
        / Math.max(project.dod * project.batteryEfficiency, 0.1)
      : 0;

    // IEC design: battery covers critical loads for backupHours regardless of day/night start time
    const hybridBackupEnergy = criticalDailyKwh * (project.backupHours / 24);
    const offgridBackupEnergy = designDailyKwh * project.autonomyDays;
    const backupEnergyNeed = project.systemType === "Off-grid" || project.systemType === "Mini-grid" ? offgridBackupEnergy : hybridBackupEnergy;
    const backupReferenceKw = backupEnergyNeed / Math.max(project.systemType === "Off-grid" || project.systemType === "Mini-grid" ? 24 * project.autonomyDays : project.backupHours, 1);
    const requiredBatteryKwh = Math.max(
      backupEnergyNeed / Math.max(project.dod * project.batteryEfficiency, 0.1),
      evBatteryBufferKwh
    );
    const batteryModules = equipmentBatteryCount(project, Math.max(1, Math.ceil(requiredBatteryKwh / project.batteryModuleKwh)));
    const batteryKwh = batteryModules * project.batteryModuleKwh;
    const usableBatteryKwh = batteryKwh * project.dod * project.batteryEfficiency;
    const autonomyHours = backupReferenceKw > 0 ? usableBatteryKwh / backupReferenceKw : 0;

    // v11.6 — calculation coherence: explain the inverter selection + DC:AC ratio.
    const inverterSizing = computeInverterSizing({
      connectedW, surgeKw, actualKwp,
      runningDiversity: project.runningLoadDiversityFactor,
      surgeDiversity: project.surgeDiversityFactor,
      inverterHeadroom: project.inverterHeadroom,
      basis: project.inverterSizingBasis,
      manualInverterKw: project.manualInverterKw,
    });
    const peakKw = inverterSizing.peakKw;
    const loadBasedInvKw = inverterSizing.loadBasedInvKw;
    const pvBasedInvKw = inverterSizing.pvBasedInvKw;
    const engineeringMinInvKw = inverterSizing.engineeringMinInvKw;
    const inverterKw = inverterSizing.selectedInverterKw;
    const dcAcAnalysis = computeDcAcAnalysis({ actualKwp, inverterKw, panelW: project.panelW, basis: inverterSizing.basis, selectedReason: inverterSizing.selectedReason });
    const dcAcRatio = dcAcAnalysis.ratio;
    const batteryInputA = project.equipmentSelection?.enabled
      ? (loadBasedInvKw * 1000) / Math.max((equipmentBankLimits(project.equipmentSelection).minimumVoltage || 0) * project.batteryEfficiency, 1)
      : (inverterKw * 1000 * 1.25) / Math.max(project.batteryVoltage * 0.8, 1);
    const batteryChemistry = batteryChemistries[project.batteryChemistry];
    const batteryNominalAh = (batteryKwh * 1000) / Math.max(project.batteryVoltage, 1);
    const documentedBank = project.equipmentSelection?.enabled ? equipmentBankLimits(project.equipmentSelection) : null;
    const bmsMaxChargeA = documentedBank ? documentedBank.currentA : batteryNominalAh * batteryChemistry.chargeC;
    const bmsMaxDischargeA = documentedBank ? documentedBank.currentA : batteryNominalAh * batteryChemistry.dischargeC;

    const vocCold = project.moduleVoc * (1 + project.tempCoeffVoc * (project.minTemp - 25));
    const maxPanelsPerString = Math.max(1, Math.floor(project.inverterMaxDcV / Math.max(vocCold, 1)));
    const panelsPerString = Math.min(Math.max(1, project.panelsPerString), panels);
    const strings = Math.max(1, Math.ceil(panels / panelsPerString));
    const stringVocCold = vocCold * panelsPerString;
    const stringVmp = project.moduleVmp * panelsPerString;
    const coldVocMargin = project.inverterMaxDcV - stringVocCold;
    const coldVocOk = stringVocCold <= project.inverterMaxDcV;
    // v11.6 — string sizing clarity (requested vs effective vs voltage limit).
    // effectivePanelsPerString mirrors the engine's panelsPerString, so the
    // cold-Voc safety check above is preserved.
    const stringSizing = computeStringSizing({
      requestedPanelsPerString: project.panelsPerString, totalPanels: panels,
      maxPanelsPerStringByVoltage: maxPanelsPerString, vocCold, moduleVmp: project.moduleVmp,
    });

    const dcCableRatedA = 1.25 * project.moduleIsc;   // IEC 62548 §6.4.1: string cable rated at 1.25 × Isc
    const dcCurrentForDrop = project.moduleImp;        // Imp used for steady-state voltage drop only
    const dcDropV = (2 * project.dcCableLengthM * dcCurrentForDrop * copperResistivity) / Math.max(project.dcCableSizeMm2, 1);
    const dcDropPct = dcDropV / Math.max(stringVmp, 1);
    const phaseFactor = project.phase.includes("Three") ? Math.sqrt(3) : 1;
    const acCurrent = (inverterKw * 1000) / Math.max(project.acVoltage * phaseFactor, 1);
    // IEC 60364-7-712: three-phase uses single conductor path with √3; normalise to 400V line voltage
    const acDropV = project.phase.includes("Three")
      ? (Math.sqrt(3) * project.acCableLengthM * acCurrent * copperResistivity) / Math.max(project.acCableSizeMm2, 1)
      : (2 * project.acCableLengthM * acCurrent * copperResistivity) / Math.max(project.acCableSizeMm2, 1);
    const acVoltageRef = project.phase.includes("Three") ? 400 : project.acVoltage;
    const acDropPct = acDropV / Math.max(acVoltageRef, 1);
    // ISO 8528-1 Annex B: 1% derate per 100m above 1000m for naturally aspirated gensets
    const gensetDeratePct = Math.max(0, 0.01 * Math.max(project.altitude - 1000, 0) / 100);
    const gensetAvailableKva = project.gensetRatedKva * (1 - gensetDeratePct);

    // ── Phase 3: Protection sizing advisory ────────────────────────────────────
    const pvArrayCurrentA = strings * dcCableRatedA;
    const dcStringFuseRequired = strings > 2;
    const _fuseRatings = [15, 20, 25, 32, 40, 50, 63, 80, 100];
    const suggestedStringFuseA = _fuseRatings.find(f => f >= dcCableRatedA) ?? _fuseRatings[_fuseRatings.length - 1];
    const _dcVRatings = [600, 800, 1000, 1200, 1500];
    const dcIsolatorVoltageRating = _dcVRatings.find(v => v >= stringVocCold) ?? 1500;
    const _dcIRatings = [20, 32, 40, 63, 80, 100, 125, 160, 250, 400];
    const dcIsolatorCurrentRating = _dcIRatings.find(c => c >= pvArrayCurrentA) ?? 400;
    const acBreakerDesignA = acCurrent * 1.25;
    const _acBreakerRatings = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250];
    const suggestedAcBreakerA = _acBreakerRatings.find(b => b >= acBreakerDesignA) ?? 250;
    const cableAmpacityTable = { 2.5: 20, 4: 26, 6: 34, 10: 46, 16: 63, 25: 85, 35: 105, 50: 130 };
    const dcCableAdvisoryA = cableAmpacityTable[project.dcCableSizeMm2] ?? 0;
    const acCableAdvisoryA = cableAmpacityTable[project.acCableSizeMm2] ?? 0;
    const dcCableAmpacityOk = dcCableAdvisoryA > 0 && dcCableAdvisoryA >= dcCableRatedA;
    const acCableAmpacityOk = acCableAdvisoryA > 0 && acCableAdvisoryA >= acBreakerDesignA;

    const dcAcStatus = dcAcAnalysis.status; // v11.6 — from the coherence engine

    // --- Specialist system flags (declared early so specialist capex can be included in totalCost) ---
    const isGensetHybrid = project.systemType === "Genset hybrid";
    const isEVCharging = project.systemType === "EV charging";
    const isMiniGrid = project.systemType === "Mini-grid";
    const isOG = project.systemType === "Off-grid";
    const evSpec = evChargerSpecs[project.evChargerType] || evChargerSpecs.L2;
    const evChargerKw = evSpec.kw;
    const ocppRequired = isEVCharging && project.evChargersTotal >= 4;
    const totalSubscribers = isMiniGrid
      ? project.mgHouseholds + project.mgCommercialCustomers + (project.mgAnchorLoad > 0 ? 1 : 0)
      : 0;

    // Specialist capex included in totalCost so payback / IRR / NPV use the real investment (Audit C2)
    const gensetAtsCost = isGensetHybrid ? 85000 : 0;
    const evChargerCapex = isEVCharging
      ? evSpec.unitCost * project.evChargersTotal
        + project.evChargersTotal * 25000
        + (ocppRequired ? 48000 : 0)
      : 0;
    const mgExtraCapex = isMiniGrid ? totalSubscribers * 6500 + 85000 : 0;
    const specialistCapex = gensetAtsCost + evChargerCapex + mgExtraCapex;

    const pvCost = panels * project.panelCost;
    const mountingCost = panels * project.mountingPerPanel;
    const inverterCost = project.inverterUnitCost;
    const batteryCost = batteryModules * project.batteryModuleCost + 16000;
    const quote = calculateQuote(
      projectQuoteLines(project, { panels, inverterCost, batteryCost, specialistCapex }),
      {
        currency: project.quoteCurrency || "KES",
        version: project.pricingPolicyVersion || "VF-11.8-01",
        contingency_pct: (Number(project.contingency) || 0) * 100,
      },
      {
        version: project.taxRuleVersion || "KE-2026-01",
        codes: { VAT_STANDARD: (Number(project.vat) || 0) * 100, VAT_ZERO: 0, VAT_EXEMPT: null },
      },
    );
    const contingencyAmount = quote.lines.find((line) => line.sku === "CONTINGENCY")?.net_amount || 0;
    const subtotalBeforeContingency = quote.subtotal_net - contingencyAmount;
    const subtotal = quote.subtotal_net;
    const vatAmount = quote.tax;
    const totalCost = quote.total_gross;

    const uncappedAnnualSavings = Math.min(annualEnergy * project.selfConsumptionRate, designDailyKwh * 365) * project.gridTariff;
    const annualBillLimit = project.monthlyBill * 12 * project.solarCoverage;
    const tariffModel = evaluateProjectTariff(project, { annualEnergy, annualLoadKwh: designDailyKwh * 365 });
    const annualSavings = tariffModel.enabled ? tariffModel.annualSavings : project.capSavingsToBill ? Math.min(uncappedAnnualSavings, annualBillLimit) : uncappedAnnualSavings;
    const annualSavingsP90 = annualSavings * project.p90Factor;
    const monthlySavings = annualSavings / 12;
    const carbonStandardData = carbonStandards[project.carbonStandard] || carbonStandards.VCS;
    const emissionFactorData = emissionFactors[project.emissionFactorSource] || emissionFactors.IPCC;
    const carbonOffset = (annualEnergy * emissionFactorData.factor) / 1000;
    const carbonOffsetMethodology = carbonOffset;
    const carbonOffsetP90 = carbonOffset * project.p90Factor;
    const carbonGrossCredits = carbonOffsetMethodology * project.carbonCreditingPeriod;
    const permanenceBufferRate = project.carbonStandard === "Internal" ? 0 : project.carbonPermanenceBuffer;
    const issuanceFeeRate = project.carbonStandard === "Internal" ? 0 : project.carbonIssuanceFee;
    const permanenceWithholding = carbonGrossCredits * permanenceBufferRate;
    const issuanceFeeDeduction = carbonGrossCredits * issuanceFeeRate;
    const netCarbonCredits = Math.max(0, carbonGrossCredits - permanenceWithholding - issuanceFeeDeduction);
    const annualNetCarbonCredits = project.carbonCreditingPeriod > 0 ? netCarbonCredits / project.carbonCreditingPeriod : 0;
    const totalVerificationEvents = carbonStandardData.verificationRequired ? Math.ceil(project.carbonCreditingPeriod / Math.max(project.carbonVerificationFrequency, 1)) : 0;
    const totalVerificationCost = totalVerificationEvents * project.carbonVerificationCostKes;
    const totalMrvCost = carbonStandardData.verificationRequired ? project.carbonMrvCostKes * project.carbonCreditingPeriod : 0;
    const totalCarbonAdminCost = totalVerificationCost + totalMrvCost;
    const carbonPriceKesFromUsd = project.carbonPriceUsd * project.usdKesRate;
    const grossCarbonRevenue = netCarbonCredits * carbonPriceKesFromUsd;
    const netCarbonRevenue = grossCarbonRevenue - totalCarbonAdminCost;
    const annualNetCarbonRevenue = project.carbonCreditingPeriod > 0 ? netCarbonRevenue / project.carbonCreditingPeriod : 0;
    const breakEvenCarbonPriceKes = annualNetCarbonCredits > 0 ? (project.carbonMrvCostKes + project.carbonVerificationCostKes / Math.max(project.carbonVerificationFrequency, 1)) / annualNetCarbonCredits : Infinity;
    const breakEvenCarbonPriceUsd = breakEvenCarbonPriceKes / Math.max(project.usdKesRate, 1);
    const lifetimeCarbonOffset = carbonOffsetMethodology * project.projectLife;
    const lifetimeCarbonOffsetP90 = lifetimeCarbonOffset * project.p90Factor;
    const isGridConnectedCarbon = project.systemType === "Solar PV – Hybrid" || project.systemType === "Genset hybrid";
    const hasAdditionalityConcern = isGridConnectedCarbon && (project.emissionFactorSource === "Kenya_National" || project.emissionFactorSource === "REREC");
    const carbonViable = annualNetCarbonRevenue > 0 && project.carbonStandard !== "Internal";
    const carbonRecommendation = project.systemType === "Mini-grid" || project.systemType === "Off-grid"
      ? "Strong additionality — off-grid systems displace diesel or provide new electricity access. VCS or Gold Standard may be worth assessing."
      : isGridConnectedCarbon && annualEnergy < 500
      ? "Small grid-tied system — MRV and verification costs are likely to exceed carbon revenue. Use Internal / CSR reporting only."
      : isGridConnectedCarbon
      ? "Grid-tied solar in Kenya faces additionality challenges because Kenya's grid is already highly renewable. Consult a carbon developer before pursuing formal registration."
      : "Assess additionality based on the specific project context.";
    const carbonValue = annualNetCarbonCredits * carbonPriceKesFromUsd;
    const annualOM = totalCost * project.oAndMRate;

    const annualFuelCost = isGensetHybrid ? project.gensetFuelLPerHour * project.gensetFuelCostKes * project.gensetRunHoursPerDay * 365 : 0;
    const annualGensetTotalCost = isGensetHybrid ? annualFuelCost + project.gensetMaintenanceCostYr : 0;
    // Phase 5: Refined displacement — solar direct + battery time-shift components
    const batteryTimeShiftFactor = isGensetHybrid && usableBatteryKwh > 0 ? (project.gensetBatteryTimeShiftDisplacement ?? 0.15) : 0;
    const solarGensetDisplacementFraction = isGensetHybrid
      ? Math.min(0.85, project.solarCoverage * (project.gensetSolarDirectDisplacement ?? 0.65) + batteryTimeShiftFactor)
      : 0;
    const newGensetRunHours = isGensetHybrid ? project.gensetRunHoursPerDay * (1 - solarGensetDisplacementFraction) : 0;
    const annualFuelSaved = isGensetHybrid ? project.gensetFuelLPerHour * project.gensetFuelCostKes * (project.gensetRunHoursPerDay - newGensetRunHours) * 365 : 0;
    const annualMaintenanceSaved = isGensetHybrid ? project.gensetMaintenanceCostYr * solarGensetDisplacementFraction * 0.5 : 0;
    const annualGensetSavings = isGensetHybrid ? annualFuelSaved + annualMaintenanceSaved : 0;
    const gensetRemainingLife = isGensetHybrid ? Math.max(0, project.gensetLifeYears - project.gensetAgeYears) : 0;
    const gensetReplacementCostAvoided = isGensetHybrid && gensetRemainingLife > 0 && gensetRemainingLife <= 5 ? 250000 : 0;
    const totalAnnualBenefit = annualSavings + annualGensetSavings;
    const annualGensetHours = isGensetHybrid ? project.gensetRunHoursPerDay * 365 : 0;
    const annualFuelLitres = isGensetHybrid ? project.gensetFuelLPerHour * project.gensetRunHoursPerDay * 365 : 0;

    const evPeakDemandKw = isEVCharging ? evChargerKw * project.evPeakSimultaneous : 0;
    const evTotalConnectedKw = isEVCharging ? evChargerKw * project.evChargersTotal : 0;
    const evDailyEnergyKwh = isEVCharging ? evChargerKw * project.evChargersTotal * project.evDailyChargingHours * project.evOccupancy : 0;
    const evAnnualEnergyKwh = evDailyEnergyKwh * 365;
    const annualEVRevenue = evAnnualEnergyKwh * project.evTariffKes;
    const annualGridCostEV = evAnnualEnergyKwh * project.gridTariff;
    const annualEVProfit = annualEVRevenue - annualGridCostEV;
    const gridConnectionAdequate = !isEVCharging || project.evGridConnectionKva * 0.8 >= evPeakDemandKw;
    const transformerRequired = isEVCharging && evPeakDemandKw > 100;

    // isMiniGrid already declared above
    const totalHouseholdKwh = isMiniGrid ? project.mgHouseholds * project.mgHouseholdLoadKwh : 0;
    const totalCommercialKwh = isMiniGrid ? project.mgCommercialCustomers * project.mgCommercialLoadKwh : 0;
    const totalAnchorKwh = isMiniGrid ? project.mgAnchorLoad * 12 : 0;
    const communityDailyKwh = totalHouseholdKwh + totalCommercialKwh + totalAnchorKwh;
    const annualResidentialRevenue = totalHouseholdKwh * 365 * project.mgResidentialTariff;
    const annualCommercialRevenue = totalCommercialKwh * 365 * project.mgCommercialTariff;
    const annualAnchorRevenue = totalAnchorKwh * 365 * project.mgAnchorTariff;
    const annualConnectionRevenue = isMiniGrid ? project.mgHouseholds * project.mgConnectionFee : 0;
    const totalAnnualRevenue = annualResidentialRevenue + annualCommercialRevenue + annualAnchorRevenue;
    // totalSubscribers declared above; reused here for opex
    const annualMiniGridOpex = totalSubscribers * project.mgOpexPerSubscriberYr + annualOM;
    const annualEBITDA = totalAnnualRevenue - annualMiniGridOpex;
    const annualEBITDAP90 = totalAnnualRevenue * project.p90Factor - annualMiniGridOpex;
    const miniGridTotalCost = totalCost + (isMiniGrid ? project.mgCapexDistribution : 0);
    const revenueMultipleOnCost = annualEBITDA > 0 ? miniGridTotalCost / annualEBITDA : Infinity;
    const miniGridPayback = annualEBITDA > 0 ? miniGridTotalCost / annualEBITDA : Infinity;
    const capexPerSubscriber = totalSubscribers > 0 ? miniGridTotalCost / totalSubscribers : 0;
    const revenuePerSubscriberYr = totalSubscribers > 0 ? totalAnnualRevenue / totalSubscribers : 0;

    const annualNet = isEVCharging
      ? annualEVProfit - annualOM
      : isMiniGrid
      ? annualEBITDA
      : isGensetHybrid
      ? totalAnnualBenefit - annualOM
      : annualSavings + (project.carbonInCashflow ? carbonValue : 0) - annualOM;
    const annualNetP90 = isEVCharging
      ? annualEVProfit * project.p90Factor - annualOM
      : isMiniGrid
      ? annualEBITDAP90
      : isGensetHybrid
      ? annualSavingsP90 + annualGensetSavings * project.p90Factor - annualOM
      : annualSavingsP90 + (project.carbonInCashflow ? carbonValue * project.p90Factor : 0) - annualOM;
    const carbonShareOfRevenue = annualNet > 0 ? annualNetCarbonRevenue / annualNet : 0;
    const investmentCost = miniGridTotalCost;
    const payback = annualNet > 0 ? investmentCost / annualNet : Infinity;
    const gensetHybridPayback = totalAnnualBenefit > 0 ? investmentCost / totalAnnualBenefit : Infinity;
    const paybackP90 = annualNetP90 > 0 ? investmentCost / annualNetP90 : Infinity;

    const debtPrincipal = investmentCost * project.debtShare;
    const equityRequired = investmentCost - debtPrincipal;
    const annualDebtService = annualPayment(debtPrincipal, project.loanInterest, project.loanTerm);
    const dscrYear1 = annualDebtService > 0 ? annualNetP90 / annualDebtService : Infinity;

    const cashflows = [-investmentCost];
    const equityCashflows = [-equityRequired];
    const annualRows = [];
    let lifetimeEnergy = 0;
    let lifetimeEnergyP90 = 0;
    let cumulativeProjectCash = -investmentCost;
    let cumulativeEquityCash = -equityRequired;
    let cumulativeDiscounted = -investmentCost;
    // Phase 6: Discounted LCOE accumulators
    let discountedCostAccum = investmentCost;
    let discountedEnergyAccum = 0;
    const battChemForRepl = batteryChemistries[project.batteryChemistry] ?? batteryChemistries.LFP;
    for (let y = 1; y <= project.projectLife; y++) {
      const energyY = annualEnergy * Math.pow(1 - project.degradation, y - 1);
      const energyP90Y = annualEnergyP90 * Math.pow(1 - project.degradation, y - 1);
      lifetimeEnergy += energyY;
      lifetimeEnergyP90 += energyP90Y;
      discountedEnergyAccum += energyY / Math.pow(1 + project.discountRate, y);
      // O&M escalates with inflation each year (Audit M3)
      const annualOmY = annualOM * Math.pow(1 + project.inflationRate, y - 1);
      const savingsY = annualSavings * Math.pow(1 + project.tariffEscalation, y - 1) * Math.pow(1 - project.degradation, y - 1);
      const savingsP90Y = annualSavingsP90 * Math.pow(1 + project.tariffEscalation, y - 1) * Math.pow(1 - project.degradation, y - 1);
      // carbonY only flows through if opt-in enabled (Audit H3)
      const carbonY = (project.carbonInCashflow ? carbonValue : 0) * Math.pow(1 + project.carbonEscalation, y - 1) * Math.pow(1 - project.degradation, y - 1);
      const evProfitY = annualEVProfit * Math.pow(1 + project.tariffEscalation, y - 1);
      const miniGridRevenueY = totalAnnualRevenue * Math.pow(1 + project.tariffEscalation, y - 1);
      // Mini-grid opex escalates with inflation separately from system O&M
      const miniGridSubscriberOpexY = totalSubscribers * project.mgOpexPerSubscriberYr * Math.pow(1 + project.inflationRate, y - 1);
      const miniGridOpexY = miniGridSubscriberOpexY + annualOmY;
      const miniGridNetY = miniGridRevenueY - miniGridOpexY + (isMiniGrid && y === 1 ? annualConnectionRevenue : 0);
      const gensetNetY = savingsY + annualGensetSavings + carbonY - annualOmY;
      // Battery replacement capex event at chemistry replacement year (Audit H2)
      const batteryReplCost = y === battChemForRepl.replacementYear ? batteryCost : 0;
      discountedCostAccum += annualOmY / Math.pow(1 + project.discountRate, y);
      if (batteryReplCost > 0) discountedCostAccum += batteryReplCost / Math.pow(1 + project.discountRate, y);
      const netY = (isEVCharging
        ? evProfitY - annualOmY
        : isMiniGrid
        ? miniGridNetY
        : isGensetHybrid
        ? gensetNetY
        : savingsY + carbonY - annualOmY) - batteryReplCost;
      const netP90Y = (isEVCharging
        ? evProfitY * project.p90Factor - annualOmY
        : isMiniGrid
        ? miniGridRevenueY * project.p90Factor - miniGridOpexY + (isMiniGrid && y === 1 ? annualConnectionRevenue : 0)
        : isGensetHybrid
        ? savingsP90Y + annualGensetSavings * project.p90Factor + carbonY * project.p90Factor - annualOmY
        : savingsP90Y + carbonY * project.p90Factor - annualOmY) - batteryReplCost;
      const debtY = y <= project.loanTerm ? annualDebtService : 0;
      const equityNetY = netY - debtY;
      const discountedNetY = netY / Math.pow(1 + project.discountRate, y);
      // Per-year DSCR for bankability review (Audit M14)
      const dscrY = debtY > 0 ? netP90Y / debtY : null;
      cumulativeProjectCash += netY;
      cumulativeEquityCash += equityNetY;
      cumulativeDiscounted += discountedNetY;
      cashflows.push(netY);
      equityCashflows.push(equityNetY);
      annualRows.push({ year: y, energyY, energyP90Y, savingsY, savingsP90Y, carbonY, annualOmY, netY, netP90Y, debtY, equityNetY, cumulativeProjectCash, cumulativeEquityCash, discountedNetY, cumulativeDiscounted, dscrY, batteryReplCost });
    }
    // Actual break-even year from cashflow table (more accurate than simple payback)
    const breakEvenYear = annualRows.find((r) => r.cumulativeProjectCash >= 0)?.year ?? null;
    // Phase 6: Discounted LCOE
    const discountedLcoe = discountedEnergyAccum > 0 ? discountedCostAccum / discountedEnergyAccum : 0;
    const discountedLcoeP90 = discountedEnergyAccum > 0 ? discountedCostAccum / (discountedEnergyAccum * project.p90Factor) : 0;
    // Phase 7: Worst-month required kWp for 90% off-grid coverage
    const requiredKwpWorstMonth90 = (isOG || isMiniGrid) && worstMonthPsh > 0 && pr > 0
      ? (designDailyKwh * 0.90) / (worstMonthPsh * pr) : 0;
    const additionalPanelsForWorstMonth = requiredKwpWorstMonth90 > 0
      ? Math.max(0, Math.ceil(requiredKwpWorstMonth90 * 1000 / project.panelW) - panels) : 0;
    const npv10 = npv(project.discountRate, cashflows.slice(0, 11));
    const npvLife = npv(project.discountRate, cashflows);
    const equityNpvLife = npv(project.discountRate, equityCashflows);
    const irrLife = irr(cashflows);
    const equityIrr = irr(equityCashflows);
    const lcoe = lifetimeEnergy > 0 ? (investmentCost + annualOM * project.projectLife) / lifetimeEnergy : 0;
    const lcoeP90 = lifetimeEnergyP90 > 0 ? (investmentCost + annualOM * project.projectLife) / lifetimeEnergyP90 : 0;
    const lcoeReal = lcoe / Math.pow(1 + project.inflationRate, project.projectLife / 2);
    const lcoeP90Real = lcoeP90 / Math.pow(1 + project.inflationRate, project.projectLife / 2);
    const breakEvenTariff = lcoe * 1.25;
    const residentialTariffViable = !isMiniGrid || project.mgResidentialTariff >= breakEvenTariff;
    const subsidyGapPerHousehold = isMiniGrid && !residentialTariffViable && project.mgHouseholds > 0 ? (breakEvenTariff - project.mgResidentialTariff) * totalHouseholdKwh * 365 / project.mgHouseholds : 0;

    const seeded = (seed) => {
      const x = Math.sin(seed * 9301 + 49297) * 233280;
      return x - Math.floor(x);
    };
    const sensitivityPaybacks = Array.from({ length: 200 }, (_, i) => {
      const costFactor = 0.85 + seeded(i + 1) * 0.3;
      const energyFactor = 0.85 + seeded(i + 401) * 0.3;
      const tariffFactor = 0.85 + seeded(i + 801) * 0.3;
      const scenarioCost = investmentCost * costFactor;
      const scenarioAnnualOM = scenarioCost * project.oAndMRate;
      // Use the correct revenue base per system type (Audit H4)
      const mcBase = isEVCharging ? annualEVProfit
        : isMiniGrid ? totalAnnualRevenue
        : isGensetHybrid ? totalAnnualBenefit
        : annualSavings + (project.carbonInCashflow ? carbonValue : 0);
      const scenarioAnnualNet = mcBase * energyFactor * tariffFactor - scenarioAnnualOM;
      return scenarioAnnualNet > 0 ? scenarioCost / scenarioAnnualNet : Infinity;
    }).filter(Number.isFinite).sort((a, b) => a - b);
    const quantile = (arr, q) => arr.length ? arr[Math.min(arr.length - 1, Math.max(0, Math.floor(q * (arr.length - 1))))] : Infinity;
    const paybackP10 = quantile(sensitivityPaybacks, 0.1);
    const paybackP50MonteCarlo = quantile(sensitivityPaybacks, 0.5);
    const paybackP90MonteCarlo = quantile(sensitivityPaybacks, 0.9);

    const warnings = [];
    if (pr < 0.65 || pr > 0.85) warnings.push("Computed PR is outside the usual Kenya design band of 0.65–0.85. Recheck loss inputs.");
    if (project.psh < 4 || project.psh > 7) warnings.push("Peak sun hours are outside the expected Kenya range of 4.0–7.0.");
    if ((project.systemType === "Off-grid" || project.systemType === "Mini-grid") && monthlyPshData.length && !offgridWorstMonthOk) {
      warnings.push(`Off-grid warning: worst month PSH is ${worstMonthPsh.toFixed(1)} hr/day in ${worstMonthName}. Worst-month solar covers ${Math.round(offgridWorstMonthCoverage * 100)}% of the monthly load target. Increase PV, reduce load, or increase autonomy.`);
    }
    if (project.panelW < 200 || project.panelW > 800) warnings.push("Panel wattage is outside the normal 200–800W range.");
    if ((project.systemType === "EV charging" || project.systemType === "Mini-grid") && dailyKwh > 0 && Math.abs(dailyKwh - designDailyKwh) / Math.max(designDailyKwh, 1) > 0.25) {
      warnings.push("Specialist system demand differs materially from the manual Load Assessment table. PV sizing is using the specialist module demand; align the load table before issuing a final quote.");
    }
    if (!inverterSizing.loadSupported || inverterSizing.catalogueExceeded) warnings.push("Selected inverter cannot satisfy the requested sizing basis within the available catalogue. A qualified engineer must design and verify a suitable inverter arrangement.");
    if (dcAcRatio < 0.8) warnings.push("PV array is small compared to inverter size. Accept only if inverter is mainly for backup/surge loads.");
    if (dcAcRatio > 1.5) warnings.push("DC:AC ratio is high. Check inverter clipping and MPPT input limits.");
    if (!coldVocOk) warnings.push("Cold Voc exceeds inverter maximum DC voltage. Reduce panels per string immediately.");
    if (dcDropPct > 0.015) warnings.push("DC cable voltage drop is above 1.5%. Increase cable size or shorten cable route.");
    if (acDropPct > 0.03) warnings.push("AC cable voltage drop is above 3%. Increase cable size or shorten cable route.");
    if (payback > 8) warnings.push("Payback is above 8 years. Recheck tariff, cost, and solar coverage assumptions.");
    if (project.systemType !== "Off-grid" && autonomyHours < project.backupHours * 0.8) warnings.push("Battery autonomy may be below the requested backup window.");
    if (dscrYear1 < 1.2 && project.debtShare > 0.3) warnings.push("P90 DSCR is below 1.20. The project may be weak for bank financing.");
    if (project.systemType === "Genset hybrid" && gensetDeratePct > 0.02) warnings.push("Genset output is materially derated by altitude. Use available kVA, not nameplate kVA, for backup design.");
    if (isGensetHybrid && newGensetRunHours < (project.gensetMinimumRuntimeHours ?? 2)) warnings.push(`Solar will reduce genset runtime below ${project.gensetMinimumRuntimeHours ?? 2} hours/day. Run genset at minimum 30% load to avoid wet stacking — consider a smaller genset or battery-only backup.`);
    if (isEVCharging && !gridConnectionAdequate) warnings.push("Peak EV demand exceeds available grid connection at 80% utilisation. Upgrade grid connection or reduce simultaneous charging with OCPP load management.");
    if (isMiniGrid && !residentialTariffViable) warnings.push(`Residential tariff is below the break-even level of KES ${breakEvenTariff.toFixed(2)}/kWh. The project requires either a grant/subsidy, concessional finance, or an anchor customer to cross-subsidise households.`);
    // Flag if inverter peak discharge demand exceeds BMS max discharge current
    if (batteryInputA > bmsMaxDischargeA) warnings.push(`Inverter peak battery draw (${num(batteryInputA, 0)}A) exceeds BMS max discharge current (${num(bmsMaxDischargeA, 0)}A) for ${batteryChemistries[project.batteryChemistry]?.label}. Add parallel battery strings or increase battery voltage.`);
    // EPRA / Kenya Energy Act 2019: mandatory notice for any grid-connected generation
    if (project.systemType === "Solar PV – Hybrid" || project.systemType === "Genset hybrid") warnings.push("KPLC/EPRA notice: Grid-tied and genset-hybrid inverters must have certified anti-islanding protection. A Generation Licence or EPRA Exemption is required under the Energy Act 2019 before connection to KPLC supply.");
    // IEC 62485-2: lead-acid battery ventilation requirement
    if (project.batteryChemistry === "VRLA" || project.batteryChemistry === "FLOODED") warnings.push("Lead-acid batteries generate hydrogen gas during charging. Battery room must comply with IEC 62485-2 ventilation requirements. Do not install in sealed or unventilated enclosures.");
    // DC cable rated current advisory
    if (dcCableRatedA > 30) warnings.push(`DC string cable must be rated ≥ ${num(dcCableRatedA, 1)}A (1.25 × Isc per IEC 62548). Verify selected ${project.dcCableSizeMm2}mm² cable ampacity at operating temperature before procurement.`);
    // Cable ampacity advisory
    if (!dcCableAmpacityOk) warnings.push(dcCableAdvisoryA > 0 ? `DC cable ${project.dcCableSizeMm2}mm² advisory ampacity (${dcCableAdvisoryA}A) may be below design current (${num(dcCableRatedA, 1)}A). Increase cable size or perform full thermal derating calculation.` : `DC cable ${project.dcCableSizeMm2}mm² has no advisory ampacity entry. Engineer verification is required; this is not a passed check.`);
    if (!acCableAmpacityOk) warnings.push(acCableAdvisoryA > 0 ? `AC cable ${project.acCableSizeMm2}mm² advisory ampacity (${acCableAdvisoryA}A) may be below design breaker current (${num(acBreakerDesignA, 1)}A). Increase cable size or perform full thermal derating calculation.` : `AC cable ${project.acCableSizeMm2}mm² has no advisory ampacity entry. Engineer verification is required; this is not a passed check.`);

    const sizingResult = {
      pr,
      connectedW,
      dayKwh,
      nightKwh,
      dailyKwh,
      designDailyKwh,
      evSizingDailyKwh,
      mgSizingCommunityDailyKwh,
      criticalDayKwh,
      criticalNightKwh,
      criticalDailyKwh,
      runningKw,
      surgeKw,
      peakKw,
      targetDailyKwh,
      requiredKwp,
      panels,
      actualKwp,
      dailySolarKwh,
      annualEnergy,
      annualEnergyP90,
      specificYield,
      roofArea,
      monthlyPshData,
      monthlyYieldRows,
      worstMonthPsh,
      worstMonthName,
      worstMonthEnergy,
      worstMonthLoad,
      offgridWorstMonthCoverage,
      offgridWorstMonthOk,
      backupEnergyNeed,
      requiredBatteryKwh,
      batteryModules,
      batteryKwh,
      usableBatteryKwh,
      autonomyHours,
      loadBasedInvKw,
      pvBasedInvKw,
      engineeringMinInvKw,
      inverterKw,
      dcAcRatio,
      dcAcStatus,
      inverterSizing,   // v11.6 — { selectedReason, isLoadLed, peakKw, ... }
      dcAcAnalysis,     // v11.6 — { severity, recommendedMinPvKwp…, correctiveActions, … }
      stringSizing,     // v11.6 — { requested/effective/maxByVoltage panels/string, note }
      batteryInputA,
      batteryNominalAh,
      bmsMaxChargeA,
      bmsMaxDischargeA,
      vocCold,
      maxPanelsPerString,
      panelsPerString,
      strings,
      stringVocCold,
      coldVocMargin,
      coldVocOk,
      dcDropV,
      dcDropPct,
      acCurrent,
      acDropV,
      acDropPct,
      gensetDeratePct,
      gensetAvailableKva,
      pvCost,
      mountingCost,
      inverterCost,
      batteryCost,
      subtotalBeforeContingency,
      contingencyAmount,
      subtotal,
      vatAmount,
      totalCost,
      investmentCost,
      quote,
      uncappedAnnualSavings,
      annualSavings,
      annualSavingsP90,
      monthlySavings,
      carbonOffset,
      carbonOffsetP90,
      carbonValue,
      carbonStandardData,
      emissionFactorData,
      carbonOffsetMethodology,
      carbonGrossCredits,
      permanenceWithholding,
      issuanceFeeDeduction,
      netCarbonCredits,
      annualNetCarbonCredits,
      totalVerificationEvents,
      totalVerificationCost,
      totalMrvCost,
      totalCarbonAdminCost,
      carbonPriceKesFromUsd,
      grossCarbonRevenue,
      netCarbonRevenue,
      annualNetCarbonRevenue,
      breakEvenCarbonPriceUsd,
      carbonShareOfRevenue,
      lifetimeCarbonOffset,
      lifetimeCarbonOffsetP90,
      hasAdditionalityConcern,
      carbonViable,
      carbonRecommendation,
      annualOM,
      annualNet,
      annualNetP90,
      payback,
      paybackP90,
      debtPrincipal,
      equityRequired,
      annualDebtService,
      dscrYear1,
      npv10,
      npvLife,
      equityNpvLife,
      irrLife,
      equityIrr,
      annualRows,
      lcoe,
      lcoeP90,
      lcoeReal,
      lcoeP90Real,
      paybackP10,
      paybackP50MonteCarlo,
      paybackP90MonteCarlo,
      annualFuelCost,
      annualGensetTotalCost,
      solarGensetDisplacementFraction,
      newGensetRunHours,
      annualFuelSaved,
      annualMaintenanceSaved,
      annualGensetSavings,
      gensetRemainingLife,
      gensetReplacementCostAvoided,
      totalAnnualBenefit,
      gensetHybridPayback,
      annualGensetHours,
      annualFuelLitres,
      evSpec,
      evChargerKw,
      evPeakDemandKw,
      evTotalConnectedKw,
      evDailyEnergyKwh,
      evAnnualEnergyKwh,
      annualEVRevenue,
      annualGridCostEV,
      annualEVProfit,
      gridConnectionAdequate,
      transformerRequired,
      ocppRequired,
      totalHouseholdKwh,
      totalCommercialKwh,
      totalAnchorKwh,
      communityDailyKwh,
      annualResidentialRevenue,
      annualCommercialRevenue,
      annualAnchorRevenue,
      annualConnectionRevenue,
      totalAnnualRevenue,
      totalSubscribers,
      annualMiniGridOpex,
      annualEBITDA,
      breakEvenTariff,
      residentialTariffViable,
      miniGridTotalCost,
      revenueMultipleOnCost,
      subsidyGapPerHousehold,
      miniGridPayback,
      capexPerSubscriber,
      revenuePerSubscriberYr,
      warnings,
      specialistCapex,
      breakEvenYear,
      dcCableRatedA,
      acVoltageRef,
      // Protection sizing (Phase 3)
      pvArrayCurrentA,
      dcStringFuseRequired,
      suggestedStringFuseA,
      dcIsolatorVoltageRating,
      dcIsolatorCurrentRating,
      acBreakerDesignA,
      suggestedAcBreakerA,
      cableAmpacityTable,
      dcCableAdvisoryA,
      acCableAdvisoryA,
      dcCableAmpacityOk,
      acCableAmpacityOk,
      // EV buffer (Phase 4)
      evBatteryBufferKwh,
      // Genset refinement (Phase 5)
      batteryTimeShiftFactor,
      // solarGensetDisplacementFraction already emitted above — removed duplicate
      // Discounted LCOE (Phase 6)
      discountedLcoe,
      discountedLcoeP90,
      // Worst-month sizing (Phase 7)
      requiredKwpWorstMonth90,
      additionalPanelsForWorstMonth,
    };
    sizingResult.loadInventoryPending = loadInventoryPending;
    sizingResult.loadInventoryInvalid = loadInventoryInvalid;
    sizingResult.loadInventoryBlocked = loadInventoryBlocked;
    sizingResult.quoteReady = !loadInventoryBlocked;
    sizingResult.quoteBlockedReason = quoteBlockedReason;
    if (!loadInventoryBlocked && (!inverterSizing.loadSupported || inverterSizing.catalogueExceeded)) {
      sizingResult.quoteReady = false;
      sizingResult.quoteBlockedReason = "Inverter engineering review required";
    }
    return gateTariffSizing(gateEquipmentSizing(project, loadInventoryBlocked ? applyLoadInventoryGate(sizingResult, quoteBlockedReason) : sizingResult), tariffModel);
  }, [projectInput, loads, tariffToday()]);
}

/* UI Helper Components in Vanilla CSS */

function Field({ label, value, onChange, type = "text", step = "any", suffix, min, max, help, emptyValue = 0, presets, disabled = false }) {
  return (
    <div className="field-group">
      <span className="field-label">{label}</span>
      <div className="field-container">
        {type === "number" ? (
          // v11.5.1 — SmartNumberField: clearable, decimal-friendly, clamps on
          // blur, never feeds NaN to calculations. onChange(number) contract
          // is unchanged so all existing call sites keep working.
          <SmartNumberField
            value={value}
            onChange={onChange}
            min={min}
            max={max}
            step={step}
            emptyValue={emptyValue}
            disabled={disabled}
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="field-input"
            disabled={disabled}
          />
        )}
        {suffix && <span className="field-suffix">{suffix}</span>}
      </div>
      {!disabled && presets && presets.length > 0 && (
        <PresetChips options={presets} value={value} onSelect={onChange} />
      )}
      {help && <span className="field-help">{help}</span>}
      {disabled && <span className="field-help">Model-linked input: edit in Asset library.</span>}
    </div>
  );
}

function SelectField({ label, value, onChange, options, help, disabled = false }) {
  return (
    <div className="field-group">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="select-input" disabled={disabled}>
        {options.map((o) => (
          <option key={o.value ?? o} value={o.value ?? o}>
            {o.label ?? o}
          </option>
        ))}
      </select>
      {help && <span className="field-help">{help}</span>}
    </div>
  );
}

function CheckField({ label, checked, onChange, help }) {
  return (
    <label className="check-container">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="check-input" />
      <div>
        <span className="check-text-title">{label}</span>
        {help && <span className="check-text-desc">{help}</span>}
      </div>
    </label>
  );
}

function Card({ title, subtitle, children, className = "" }) {
  return (
    <section className={`card ${className}`}>
      <div className="card-header">
        <h2 className="card-title">{title}</h2>
        {subtitle && <p className="card-subtitle">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, hint, danger, good }) {
  let cardClass = "metric-card";
  if (danger) cardClass += " danger";
  if (good) cardClass += " good";
  return (
    <div className={cardClass}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {hint && <div className="metric-hint">{hint}</div>}
    </div>
  );
}

function Sidebar({ active, setActive, project, sidebarOpen, setSidebarOpen, viewMode, setViewMode, hasActiveProject, onExitToStart, actorRole, enforceRoleAccess = false }) {
  const nav = (key) => { setActive(key); setSidebarOpen(false); };
  const groups = getWorkspaceNavigation({ viewMode, project,
    canAccess: (key) => !enforceRoleAccess || isTabAllowedForRole(key, actorRole) });
  return (
    <aside id="workspace-sidebar" className={`sidebar ${sidebarOpen ? "show" : ""}`}>
      <div className="sidebar-logo-card">
        <BrandLogo style={{ height: "56px", marginBottom: "0.35rem", display: "block" }} />
        <div className="logo-desc">Solarise Pro powered by Voltflow</div>
      </div>
      {/* v11.4.1 — active project chip + way back to the start screen */}
      {hasActiveProject && (
        <div style={{ marginBottom: "1rem", padding: "0.6rem 0.75rem", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.6rem" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.06em", color: "rgba(255,255,255,0.5)" }}>ACTIVE PROJECT</div>
          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff", marginTop: "0.15rem", wordBreak: "break-word" }}>
            {project.client || "Untitled project"}
          </div>
          {project.isDemo && <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "#c4b5fd", marginTop: "0.15rem" }}>🧪 DEMO DATA</div>}
        </div>
      )}
      {hasActiveProject && <button type="button" className="vfw-home-link" onClick={onExitToStart}>← Workspace home</button>}
      {/* v11.4 — view mode switches WHAT IS SHOWN only; nothing is recalculated
          and every tab stays reachable by returning to Engineer view. */}
      <div style={{ marginBottom: "1rem" }}>
        <div className="sidebar-section-label" style={{ marginTop: 0 }}>View mode</div>
        <div className="vf-viewmode-bar" role="group" aria-label="View mode">
          {[["engineer", "⚙ Engineer"], ["client", "👤 Client"], ["technician", "🔧 Technician"], ["bank", "🏦 Finance"]].map(([mode, label]) => (
            <button key={mode}
              className={`vf-viewmode-btn ${viewMode === mode ? "active" : ""}`}
              aria-pressed={viewMode === mode}
              onClick={() => setViewMode(mode)}
              title={`${label.split(" ")[1]} view`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {/* v11.4.1 — no navigation until a project is active: the start screen is
          the only way in, so tabs can't be opened against an empty project. */}
      {!hasActiveProject ? (
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Getting started</div>
          <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.6, padding: "0 0.25rem" }}>
            Create a new project, open a saved one, import a JSON file, or try a demo to explore Voltflow.
            Project tabs appear once a project is active.
          </div>
        </nav>
      ) : (
        <WorkspaceNavigation groups={groups} active={active} onNavigate={nav} />
      )}
      <div className="sidebar-footer">
        {APP_VERSION} · {TRUST_FOUNDATION_VERSION} · Solar EPC Platform · Kenya
      </div>
    </aside>
  );
}

function ReadinessBadge({ readiness, setActive }) {
  if (!readiness) return null;
  const { totalScore, readyStatus, blockers } = readiness;
  const colour = readyStatus === "Ready to propose" ? "#10b981"
    : readyStatus === "Ready with engineer review" ? "#f59e0b"
    : readyStatus === "High risk — do not send" ? "#ef4444"
    : "#64748b";
  return (
    <div onClick={() => setActive("readiness")} style={{ cursor:"pointer", padding:"0.75rem 1rem", background:"#f8fafc", border:`2px solid ${colour}`, borderRadius:"0.6rem", display:"flex", alignItems:"center", gap:"0.75rem" }}>
      <div style={{ width:"42px", height:"42px", borderRadius:"50%", background:colour, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:"0.85rem", flexShrink:0 }}>
        {totalScore}
      </div>
      <div>
        <div style={{ fontWeight:700, fontSize:"0.85rem", color:"#0f172a" }}>{readyStatus}</div>
        <div style={{ fontSize:"0.75rem", color:"#64748b" }}>{blockers.length > 0 ? `${blockers.length} blocker(s)` : "Click for full report"}</div>
      </div>
    </div>
  );
}

/* ─── CLIENT VIEW DASHBOARD — v11.4 ─────────────────────────────────────
   A plain-language summary for non-technical readers. Same numbers as the
   engineer view (nothing is recalculated) — just far fewer of them.
   ──────────────────────────────────────────────────────────────────────── */
function ClientDashboard({ project, sizing, setActive, advisory, simulation }) {
  const clientExp = advisory?.clientFriendlySummary;
  const backupHours = Number(sizing.autonomyHours) || 0;
  const monthlySaving = (Number(sizing.annualSavings) || 0) / 12;
  const loadBlocked = !!sizing.loadInventoryBlocked || !!sizing.loadInventoryPending || !!sizing.loadInventoryInvalid;
  const blockedText = sizing.quoteBlockedReason || LOAD_PENDING_LABEL;
  const blockedHint = "Add committed loads and click Update Sizing.";
  const paybackText = loadBlocked ? blockedText : Number.isFinite(sizing.payback) ? `${num(sizing.payback, 1)} years` : "Not viable as configured";

  return (
    <div className="vf-page-enter">
      <PageHeader
        eyebrow="Proposed solar system"
        title={project.client || "Your solar proposal"}
        description={`${project.location || "Site"} · ${project.systemType}`}
        actions={<button onClick={() => setActive("proposal")} className="btn btn-primary">View full proposal →</button>}
      />

      {loadBlocked && (
        <WarningPanel tone="warning" title={blockedText}>
          This project is not quote-ready. Complete the load inventory before presenting PV size, battery size, inverter rating, BoQ, investment or savings.
        </WarningPanel>
      )}

      <SectionHeader title="What we recommend" subtitle="The system size our assessment points to for this site." />
      <CardGrid min={220}>
        <Metric label="Solar Array" value={loadBlocked ? blockedText : `${num(sizing.actualKwp, 1)} kWp`} hint={loadBlocked ? blockedHint : `${sizing.panels} panels on your roof`} />
        <Metric label="Battery Storage" value={loadBlocked ? blockedText : `${num(sizing.batteryKwh, 1)} kWh`} hint={loadBlocked ? blockedHint : backupHours > 0 ? `About ${num(backupHours, 1)} hours of backup` : "Backup storage"} />
        <Metric label="Inverter" value={loadBlocked ? blockedText : `${num(sizing.inverterKw, 1)} kW`} hint={loadBlocked ? blockedHint : "Converts solar to usable power"} />
        <Metric label="Estimated Investment" value={loadBlocked ? blockedText : money(sizing.totalCost)} hint={loadBlocked ? blockedHint : "Indicative - confirmed on final quotation"} />
      </CardGrid>

      <SectionHeader title="What you can expect" subtitle="Based on the loads and site information captured for this project." />
      <CardGrid min={220}>
        <Metric label="Estimated Monthly Saving" value={loadBlocked ? blockedText : money(monthlySaving)} good={!loadBlocked && monthlySaving > 0} hint={loadBlocked ? blockedHint : "Average across the year"} />
        <Metric label="Estimated Payback" value={paybackText} hint="Time to recover the investment" />
        <Metric label="Backup During Outages" value={loadBlocked ? blockedText : backupHours > 0 ? `~${num(backupHours, 1)} hrs` : "—"} hint={loadBlocked ? blockedHint : "On your essential loads"} />
        <Metric label="Clean Energy Per Year" value={loadBlocked ? blockedText : `${num(sizing.annualEnergy, 0)} kWh`} hint={loadBlocked ? blockedHint : `≈ ${num(sizing.carbonOffset, 1)} tonnes CO₂ avoided`} />
      </CardGrid>

      {clientExp && (
        <Card title="In plain language" subtitle="A short summary of this proposal without technical jargon.">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            {[["What we found", clientExp.whatWeFound],
              ["What we recommend", clientExp.recommendation],
              ["What this system will do", clientExp.whatItWillDo],
              ["What it will not do", clientExp.whatItWillNot],
              ["Expected savings", clientExp.savings]]
              .filter(([, text]) => text)
              .map(([heading, text]) => (
                <div key={heading}>
                  <div style={{ fontWeight: 800, fontSize: "0.82rem", color: "var(--text-main)", marginBottom: "0.2rem" }}>{heading}</div>
                  <div style={{ fontSize: "0.87rem", color: "var(--text-medium)", lineHeight: 1.6 }}>{text}</div>
                </div>
              ))}
          </div>
        </Card>
      )}

      <Card title="Next steps" subtitle="How this proposal moves forward.">
        <ol style={{ margin: 0, paddingLeft: "1.15rem", fontSize: "0.87rem", color: "var(--text-medium)", lineHeight: 1.9 }}>
          <li>Review the full proposal and ask us any questions.</li>
          <li>We confirm the equipment schedule and final pricing with you.</li>
          <li>A qualified engineer reviews and signs off the final design.</li>
          <li>Installation is scheduled, completed and commissioned with handover documents.</li>
        </ol>
        <ActionBar>
          <button onClick={() => setActive("proposal")} className="btn btn-primary">Open full proposal</button>
          <button onClick={() => setActive("assistant")} className="btn btn-secondary">✨ Ask a question</button>
        </ActionBar>
      </Card>

      <WarningPanel tone="info" title="Please note">
        This is a feasibility quotation and proposal support document. Final engineering design and installation
        approval require qualified review. Figures are estimates based on the information collected for this site.
      </WarningPanel>
    </div>
  );
}

/* ─── FLOATING ACTION CENTER — v11.5.2 ──────────────────────────────────────
   One drawer that tells the user everything outstanding, each with a "Go fix"
   that navigates + highlights. Reads the central readiness engine. */
const PRIORITY_RANK = { critical: 0, required: 1, warning: 2, recommended: 3 };
const PRIORITY_TONE = { critical: "danger", required: "warning", warning: "warning", recommended: "info" };

function buildActionItems(readiness, hasUnappliedLoadChanges) {
  const items = [];
  (readiness.criticalIssues || []).forEach((c) => items.push({ priority: "critical", section: "Safety", issue: c.label, actionTab: c.actionTab, highlightId: c.highlightId, explain: "Resolve before issuing any quotation." }));
  (readiness.warnings || []).forEach((w) => items.push({ priority: w.priority || "warning", section: w.actionTab, issue: w.label, actionTab: w.actionTab, highlightId: w.highlightId, explain: "" }));
  (readiness.missingFields || []).filter((m) => m.priority === "required").forEach((m) => items.push({ priority: "required", section: m.section, issue: m.item, actionTab: m.actionTab, highlightId: m.highlightId, explain: m.actionLabel }));
  // De-dupe by issue text, sort by priority
  const seen = new Set();
  return items.filter((i) => (seen.has(i.issue) ? false : (seen.add(i.issue), true)))
    .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9));
}

function FloatingActionCenter({ readiness, open, onOpen, onClose, navigateToTab, viewMode, hasUnappliedLoadChanges }) {
  const items = buildActionItems(readiness, hasUnappliedLoadChanges);
  const criticalCount = items.filter((i) => i.priority === "critical").length;
  const total = items.length;

  // Route gating comes from the shared navigation rules (one source of truth).
  const canRoute = (tab) => isTabAllowedInView(tab, viewMode);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <>
      {!open && (
        <button className={`vf-action-fab ${criticalCount > 0 ? "vf-pulse" : ""}`} onClick={onOpen} title="Project Action Center">
          🎯 Action Center
          {total > 0 && <span className="vf-fab-badge">{total}</span>}
        </button>
      )}
      {open && (
        <>
          <div className="vf-action-overlay" onClick={onClose} />
          <aside className="vf-action-drawer" role="dialog" aria-label="Project Action Center">
            <div className="vf-action-drawer-head">
              <div>
                <div style={{ fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.05em", color: "var(--text-muted)" }}>PROJECT ACTION CENTER</div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>
                  {total === 0 ? "All clear" : `${total} item${total === 1 ? "" : "s"} to address`}
                </div>
              </div>
              <button onClick={onClose} className="btn btn-secondary" style={{ padding: "0.3rem 0.7rem" }}>✕</button>
            </div>
            <div className="vf-action-drawer-body">
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "1rem" }}>
                <ReadinessRing score={readiness.overallScore} size={72} label="ready" />
                <div style={{ fontSize: "0.8rem", color: "var(--text-medium)", lineHeight: 1.5 }}>
                  {readiness.readyForProposal ? "Ready for proposal." : "Not yet ready for proposal — work through the items below."}
                </div>
              </div>

              {total === 0 ? (
                <EmptyState icon="✅" title="Nothing outstanding" description="No blockers, missing required fields or warnings right now." />
              ) : items.map((it, i) => {
                const routable = canRoute(it.actionTab);
                return (
                  <div key={i} className={`vf-action-item ${it.priority === "critical" ? "vf-glow-warn" : ""}`}>
                    <StatusPill tone={PRIORITY_TONE[it.priority] || "neutral"}>{it.priority}</StatusPill>
                    <div className="vf-action-body">
                      <div className="vf-action-title">{it.issue}</div>
                      {it.explain && <div className="vf-action-detail">{it.explain}</div>}
                      {routable ? (
                        <button className="btn btn-primary" style={{ marginTop: "0.4rem", padding: "0.28rem 0.7rem", fontSize: "0.76rem" }}
                          onClick={() => {
                            navigateToTab(it.actionTab, { source: "action_center", highlightId: it.highlightId, toast: `Opened ${it.section} to fix: ${it.issue}` });
                            onClose();
                          }}>
                          Go fix →
                        </button>
                      ) : (
                        <div style={{ marginTop: "0.4rem", fontSize: "0.74rem", color: "var(--text-muted)" }}>
                          Switch to Engineer View to edit this section.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <div style={{ marginTop: "1rem", padding: "0.6rem 0.8rem", background: "var(--bg-main)", border: "1px solid var(--border-medium)", borderRadius: "var(--radius-md)", fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                Proposal status: <strong>{readiness.readyForProposal ? "Ready" : `${readiness.missingFields.filter((m) => m.priority !== "recommended").length} item(s) outstanding`}</strong>.
                Advisory only — final engineering review still required.
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

/* ─── READINESS DASHBOARD — v11.5.2 (readiness-engine driven) ──────────────── */
function ReadinessDashboard({ project, sizing, readiness, viewMode, navigateToTab, onOpenActionCenter, highlightId }) {
  const s = readiness.sections;
  const engineerOrder = ["clientDetails", "siteSurvey", "loadInventory", "energyImport", "pvSizing", "batterySizing", "inverterSafety", "engineeringCompliance", "boq", "proposal", "delivery", "handover"];
  const techOrder = ["clientDetails", "siteSurvey", "loadInventory", "inverterSafety", "delivery", "handover"];
  const order = viewMode === "technician" ? techOrder : engineerOrder;
  const scoreColour = readiness.overallScore >= 80 ? "#10b981" : readiness.overallScore >= 50 ? "#f59e0b" : "#ef4444";
  const loadBlocked = !!sizing.loadInventoryBlocked || !!sizing.loadInventoryPending || !!sizing.loadInventoryInvalid;
  const blockedText = sizing.quoteBlockedReason || LOAD_PENDING_LABEL;

  return (
    <div className="vf-page-enter">
      <PageHeader
        eyebrow={viewMode === "technician" ? "Field readiness" : "Project readiness"}
        title={project.client || "Untitled project"}
        description={`${project.location || "No location set"}${project.systemType ? ` · ${project.systemType}` : ""}`}
        actions={<button onClick={onOpenActionCenter} className="btn btn-primary">🎯 Action Center{readiness.criticalIssues.length > 0 ? ` (${readiness.criticalIssues.length})` : ""}</button>}
      />

      {loadBlocked && (
        <WarningPanel tone="warning" title={blockedText}>
          Dashboard, BoQ, proposal and financial outputs are pending until committed valid loads are applied.
        </WarningPanel>
      )}

      {/* Hero: ring + verdict + key metrics */}
      <Card title="" subtitle="">
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <ReadinessRing score={readiness.overallScore} size={110} label="/ 100" />
          <div style={{ flex: 1, minWidth: "220px" }}>
            <StatusPill tone={readiness.criticalIssues.length > 0 ? "danger" : readiness.readyForProposal ? "success" : "warning"}>
              {readiness.criticalIssues.length > 0 ? "Engineering review required" : readiness.readyForProposal ? "Ready for proposal" : "In progress"}
            </StatusPill>
            <div style={{ marginTop: "0.6rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.5rem" }}>
              <Metric label="PV" value={loadBlocked ? blockedText : `${num(sizing.actualKwp, 1)} kWp`} />
              <Metric label="Battery" value={loadBlocked ? blockedText : `${num(sizing.batteryKwh, 1)} kWh`} />
              <Metric label="Inverter" value={loadBlocked ? blockedText : `${num(sizing.inverterKw, 1)} kW`} />
              {viewMode !== "technician" && <Metric label="Investment" value={loadBlocked ? blockedText : money(sizing.totalCost)} />}
            </div>
          </div>
        </div>
      </Card>

      {/* Critical blockers */}
      {readiness.criticalIssues.length > 0 && (
        <WarningPanel tone="danger" title={`${readiness.criticalIssues.length} critical issue(s) — resolve before quoting`}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {readiness.criticalIssues.map((c, i) => (
              <button key={i} onClick={() => navigateToTab(c.actionTab, { source: "dashboard", highlightId: c.highlightId, toast: `Opened to fix: ${c.label}` })}
                style={{ textAlign: "left", background: "transparent", border: "none", color: "#7f1d1d", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", padding: "0.15rem 0" }}>
                ⛔ {c.label} — Go fix →
              </button>
            ))}
          </div>
        </WarningPanel>
      )}

      {/* Next 3 actions */}
      <Card title="Next actions" subtitle="What to do next, in priority order.">
        <ol style={{ margin: 0, paddingLeft: "1.15rem", fontSize: "0.87rem", color: "var(--text-medium)", lineHeight: 1.9 }}>
          {readiness.nextActions.map((a, i) => (
            <li key={i}>
              <button onClick={() => navigateToTab(a.actionTab, { source: "dashboard", highlightId: a.highlightId, toast: `Opened: ${a.label}` })}
                style={{ background: "transparent", border: "none", color: "var(--color-primary)", fontWeight: 600, cursor: "pointer", padding: 0, textAlign: "left", fontSize: "0.87rem" }}>
                {a.label} →
              </button>
            </li>
          ))}
        </ol>
      </Card>

      {/* Night-load caution */}
      {readiness.night?.nightAutonomyWarning && (
        <WarningPanel tone={readiness.night.nightEnergyCoverage < 1 ? "warning" : "info"} title="Night-load autonomy">
          {readiness.night.nightAutonomyWarning}
          {" "}
          <button onClick={() => navigateToTab("battery", { source: "dashboard", highlightId: "night-autonomy-card" })}
            style={{ background: "transparent", border: "none", color: "var(--color-primary)", fontWeight: 700, cursor: "pointer" }}>Review Battery →</button>
        </WarningPanel>
      )}

      {/* Section progress cards (clickable) */}
      <SectionHeader title="Section progress" subtitle="Click any section to jump straight to it." />
      <CardGrid min={240}>
        {order.map((k) => s[k] && (
          <ProgressCard key={k} sectionData={s[k]} highlighted={!!highlightClass(highlightId, s[k].highlightId)}
            onClick={() => navigateToTab(s[k].actionTab, { source: "dashboard", highlightId: s[k].highlightId, toast: `Opened ${s[k].label}.` })} />
        ))}
      </CardGrid>

      <WarningPanel tone="info" title="Voltflow Internal Alpha">
        Readiness is a workflow aid, not certified engineering approval. Verify every number and get qualified review before installation or client sign-off.
      </WarningPanel>
    </div>
  );
}

function Dashboard({ project, sizing, setActive, readiness, advisory, governance, panelLayout, roofWarnings, simWarnings, hasUnappliedLoadChanges }) {
  const simDanger = (simWarnings || []).filter((w) => w.level === "danger").length;
  const topBlocker = readiness?.blockers?.[0] || null;
  const loadBlocked = !!sizing.loadInventoryBlocked || !!sizing.loadInventoryPending || !!sizing.loadInventoryInvalid;
  const blockedText = sizing.quoteBlockedReason || LOAD_PENDING_LABEL;
  const blockedHint = "Add committed loads and click Update Sizing.";
  const govColour = governance?.status === "Ready to send" || governance?.status === "Won" ? "#10b981"
    : governance?.status === "High risk — do not send" || governance?.status === "Lost" ? "#ef4444"
    : governance?.status === "Sent" ? "#3b82f6"
    : governance?.status === "Manager review required" ? "#7c3aed"
    : "#f59e0b";
  return (
    <div className="dashboard-wrapper">
      <div className="banner">
        <div className="banner-flex">
          <div>
            <div className="banner-sub">System sizing dashboard</div>
            <h1 className="banner-title">{project.client}</h1>
            <p className="banner-desc">
              {project.location} · {project.systemType} · {project.designStage}
            </p>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"0.5rem", alignItems:"flex-end" }}>
            <button onClick={() => setActive("proposal")} className="btn btn-secondary">Open Proposal</button>
            <button onClick={() => setActive("readiness")} className="btn btn-accent" style={{ fontSize:"0.8rem", padding:"0.35rem 0.9rem" }}>Readiness Report</button>
          </div>
        </div>
      </div>

      {/* Draft load warning banner */}
      {hasUnappliedLoadChanges && (
        <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: "0.5rem", padding: "0.6rem 1rem", marginBottom: "0.5rem", fontSize: "0.82rem", color: "#78350f", fontWeight: 600 }}>
          ⚠ You have unapplied load changes. Go to Load Assessment and click <strong>Update Sizing</strong> to refresh PV, battery and financial results.
        </div>
      )}
      {loadBlocked && (
        <WarningPanel tone="warning" title={blockedText}>
          This sizing overview is not quote-ready. Complete committed valid loads before showing PV, battery, inverter, BoQ, proposal or investment values.
        </WarningPanel>
      )}

      {/* v11.1 — What-to-do-next strip: quote status, next action, top blocker, work state */}
      {governance && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div onClick={() => setActive("readiness")} style={{ cursor: "pointer", padding: "0.7rem 0.9rem", background: "#fff", border: `2px solid ${govColour}`, borderRadius: "0.6rem" }}>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.04em" }}>QUOTE STATUS</div>
            <div style={{ fontSize: "0.9rem", fontWeight: 800, color: govColour, marginTop: "0.15rem" }}>{governance.status}</div>
          </div>
          <div style={{ padding: "0.7rem 0.9rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.6rem" }}>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.04em" }}>NEXT ACTION</div>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#0f172a", marginTop: "0.15rem" }}>→ {governance.nextAction?.[0] || "No action required"}</div>
          </div>
          <div style={{ padding: "0.7rem 0.9rem", background: topBlocker ? "#fef2f2" : "#f0fdf4", border: `1px solid ${topBlocker ? "#fca5a5" : "#86efac"}`, borderRadius: "0.6rem" }}>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.04em" }}>TOP BLOCKER</div>
            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: topBlocker ? "#7f1d1d" : "#166534", marginTop: "0.15rem" }}>
              {topBlocker || "✓ No blockers"}
            </div>
          </div>
          <div style={{ padding: "0.7rem 0.9rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.6rem" }}>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.04em" }}>WORK STATE</div>
            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#0f172a", marginTop: "0.15rem" }}>
              Loads: {hasUnappliedLoadChanges ? "✏ draft edits pending" : "✓ applied"} · Simulation: {simDanger > 0 ? `⛔ ${simDanger} critical` : (simWarnings || []).length > 0 ? `⚠ ${simWarnings.length} warning(s)` : "✓ clear"}
            </div>
          </div>
        </div>
      )}

      <div className="grid-cols-4">
        <Metric label="PV Array" value={loadBlocked ? blockedText : `${num(sizing.actualKwp, 1)} kWp`} hint={loadBlocked ? blockedHint : `${sizing.panels} × ${project.panelW}W panels`} />
        <Metric label="Battery Bank" value={loadBlocked ? blockedText : `${num(sizing.batteryKwh, 1)} kWh`} hint={loadBlocked ? blockedHint : `${sizing.batteryModules} modules · ${num(sizing.autonomyHours, 1)} hrs autonomy`} />
        <Metric label="Inverter" value={loadBlocked ? blockedText : `${num(sizing.inverterKw, 1)} kW`} hint={loadBlocked ? blockedHint : `Engineering min ${num(sizing.engineeringMinInvKw, 1)} kW`} />
        <Metric label="Total Cost" value={loadBlocked ? blockedText : money(sizing.totalCost)} hint={loadBlocked ? blockedHint : `P50 payback ${num(sizing.payback, 2)} yrs`} />
      </div>

      <div className="grid-cols-4">
        <Metric label="Computed PR" value={pct(sizing.pr)} hint="Calculated from loss factors" good={sizing.pr >= 0.65 && sizing.pr <= 0.85} />
        <Metric label="P50 / P90 Energy" value={loadBlocked ? blockedText : `${num(sizing.annualEnergy, 0)} / ${num(sizing.annualEnergyP90, 0)}`} hint={loadBlocked ? blockedHint : "kWh/year"} />
        <Metric label="LCOE P50/P90" value={loadBlocked ? blockedText : `${num(sizing.lcoe, 2)} / ${num(sizing.lcoeP90, 2)}`} hint={loadBlocked ? blockedHint : "KES/kWh - canonical feasibility basis"} />
        <Metric label="P90 DSCR" value={loadBlocked ? blockedText : project.debtShare > 0 ? num(sizing.dscrYear1, 2) : "N/A"} hint={loadBlocked ? blockedHint : project.debtShare > 0 ? "Bankability check" : "Equity-only case"} danger={!loadBlocked && sizing.dscrYear1 < 1.2 && project.debtShare > 0.3} />
      </div>

      {/* Roof fit status */}
      {panelLayout && panelLayout.estimatedPanelsThatFit > 0 && (
        <div className="grid-cols-4" style={{ gap: "0.75rem", marginBottom: "0.5rem" }}>
          <Metric label="Roof Fit Status"
            value={panelLayout.roofFitStatus?.split("—")[0]?.trim() || "—"}
            good={panelLayout.roofFitStatus?.startsWith("Fits comfortably")}
            danger={panelLayout.roofFitStatus?.startsWith("Does not")} />
          <Metric label="Panels Required" value={`${panelLayout.requiredPanels}`} />
          <Metric label="Panels That Fit" value={`${panelLayout.estimatedPanelsThatFit}`} hint={panelLayout.recommendedPanelOrientation} />
          <Metric label="Roof Utilisation" value={`${(panelLayout.roofUtilisationPercent || 0).toFixed(0)}%`}
            danger={panelLayout.roofUtilisationPercent > 95} />
        </div>
      )}
      {roofWarnings && roofWarnings.filter(w => w.level === "danger").map((w, i) => (
        <div key={i} style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "0.5rem", padding: "0.5rem 0.85rem", marginBottom: "0.4rem", fontSize: "0.82rem", color: "#7f1d1d", fontWeight: 600 }}>
          ⛔ {w.msg}
        </div>
      ))}

      {/* Installer simulation status strip */}
      {simWarnings && simWarnings.length > 0 && (
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "0.5rem", padding: "0.6rem 1rem", marginBottom: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.82rem", color: "#78350f", fontWeight: 600 }}>
            ⚠ {simWarnings.filter(w => w.level === "danger").length > 0
              ? `${simWarnings.filter(w => w.level === "danger").length} critical installer warning(s)`
              : `${simWarnings.length} installer warning(s) — review before installation`}
          </span>
          <button onClick={() => setActive("installer-sim")} style={{ fontSize: "0.78rem", padding: "0.3rem 0.8rem", background: "#f59e0b", color: "#fff", border: "none", borderRadius: "0.4rem", cursor: "pointer", fontWeight: 700 }}>
            View Installer Simulation →
          </button>
        </div>
      )}

      {readiness && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem", marginBottom:"0.5rem" }}>
          <ReadinessBadge readiness={readiness} setActive={setActive} />
          <div style={{ padding:"0.75rem 1rem", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:"0.6rem", fontSize:"0.8rem", color:"#475569" }}>
            {advisory?.commercialAdvice?.[0] ? <><b>💡 Commercial:</b> {advisory.commercialAdvice[0]}</> : <><b>✅</b> No commercial flags.</>}
          </div>
        </div>
      )}
      <Card title="Engineering flags" subtitle="Do not submit a commercial proposal before clearing red safety flags.">
        {sizing.warnings.length === 0 ? (
          <div className="alert-success-banner">No major sizing warnings detected.</div>
        ) : (
          <div className="alert-list">
            {sizing.warnings.map((w, i) => (
              <div key={i} className="alert-box">
                ⚠️ {w}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ProjectInputs({ project, setProject, setActive }) {
  const update = (k, v) => {
    setProject((p) => ({ ...p, [k]: v }));
    // Reset to dashboard when switching system type so hidden specialist tabs don't show blank (Audit C3)
    if (k === "systemType") setActive("dashboard");
  };
  const applySite = (site) => {
    const s = siteProfiles[site];
    setProject((p) => ({ ...p, siteProfile: site, psh: s.psh, cellTemp: s.cellTemp, soilingLoss: s.soilingLoss, minTemp: s.minTemp, altitude: s.altitude, location: site }));
  };
  const applyChemistry = (chem) => {
    const c = batteryChemistries[chem];
    setProject((p) => ({ ...p, batteryChemistry: chem, dod: c.dod, batteryEfficiency: c.efficiency }));
  };
  return (
    <div className="grid-cols-2">
      <Card title="Client & project setup" subtitle="Project type controls key engineering assumptions.">
        <div className="form-grid">
          <Field label="Client / Company" value={project.client} onChange={(v) => update("client", v)} />
          <Field label="Prepared By" value={project.preparedBy} onChange={(v) => update("preparedBy", v)} />
          <SelectField label="System Type" value={project.systemType} onChange={(v) => update("systemType", v)} options={["Solar PV – Hybrid", "Off-grid", "EV charging", "Genset hybrid", "Mini-grid"]} />
          <SelectField label="Phase" value={project.phase} onChange={(v) => update("phase", v)} options={["Single Phase (230V)", "Three Phase (400V)"]} />
          <SelectField label="Kenya Site Profile" value={project.siteProfile} onChange={applySite} options={Object.keys(siteProfiles)} help="Auto-fills PSH, cell temperature, soiling, altitude and minimum temperature." />
          <Field label="Location / Site Name" value={project.location} onChange={(v) => update("location", v)} />
          <Field label="Monthly Bill Reference" type="number" value={project.monthlyBill} onChange={(v) => update("monthlyBill", Math.max(v, 0))} suffix="KES" />
          <Field label="Solar Coverage Target" type="number" value={project.solarCoverage} onChange={(v) => update("solarCoverage", clamp(v, 0, 1))} suffix="0-1" />
          <Field label="Peak Sun Hours" type="number" value={project.psh} onChange={(v) => update("psh", clamp(v, 3, 8))} suffix="hrs" help="Kenya validation band: 4.0–7.0." />
          <Field label="Cell Temperature" type="number" value={project.cellTemp} onChange={(v) => update("cellTemp", clamp(v, 25, 75))} suffix="°C" />
        </div>
      </Card>
      <Card title="Battery & commercial assumptions" subtitle="Chemistry selection replaces raw DoD guesswork.">
        <div className="form-grid">
          <SelectField disabled={!!project.equipmentSelection?.enabled} label="Battery Chemistry" value={project.batteryChemistry} onChange={applyChemistry} options={Object.entries(batteryChemistries).map(([value, data]) => ({ value, label: data.label }))} />
          <Field label="Depth of Discharge" type="number" value={project.dod} onChange={(v) => update("dod", clamp(v, 0.1, 1))} suffix="0-1" />
          <Field label="Battery Efficiency" type="number" value={project.batteryEfficiency} onChange={(v) => update("batteryEfficiency", clamp(v, 0.5, 0.99))} suffix="0-1" />
          <Field disabled={!!project.equipmentSelection?.enabled} label="Battery Module Size" type="number" value={project.batteryModuleKwh} onChange={(v) => update("batteryModuleKwh", Math.max(v, 0.1))} suffix="kWh" />
          <Field label="Backup Hours" type="number" value={project.backupHours} onChange={(v) => update("backupHours", clamp(v, 1, 72))} suffix="hrs" />
          <Field label="Off-grid Autonomy" type="number" value={project.autonomyDays} onChange={(v) => update("autonomyDays", clamp(v, 0.5, 7))} suffix="days" />
          <Field disabled={!!project.equipmentSelection?.enabled} label="Panel Wattage" type="number" value={project.panelW} onChange={(v) => update("panelW", v)} min={200} max={800} suffix="W" presets={[450, 550, 585, 600, 610]} />
          <Field disabled={!!project.equipmentSelection?.enabled} label="Panel Unit Cost" type="number" value={project.panelCost} onChange={(v) => update("panelCost", Math.max(v, 0))} suffix="KES" />
        </div>
        <div className="carbon-info" style={{ marginTop: "1.5rem" }}>
          Selected chemistry: <b>{batteryChemistries[project.batteryChemistry].label}</b> · Cycle life: <b>{nf.format(batteryChemistries[project.batteryChemistry].cycleLife)}</b> · Indicative replacement year: <b>{batteryChemistries[project.batteryChemistry].replacementYear}</b>.
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   ENERGY DATA IMPORT — v11.2 (data logger / energy survey / pasted table)
   Feeds the existing draft-load workflow only; the sizing engine is untouched.
   Raw parsed rows live in component state (session-only) — just the compact
   analysis summary is persisted on the project (see normalizeEnergyImport).
   ═══════════════════════════════════════════════════════════════════════ */

function EnergyMiniBarChart({ data, unit = "", color = "#3b82f6", height = 150, labelEvery = 1 }) {
  if (!data || data.length === 0) return null;
  const W = 720, H = height, M = 26;
  const max = Math.max(...data.map((d) => d.value), 0.001);
  const bw = (W - 2 * M) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: "720px", display: "block" }}>
      {data.map((d, i) => {
        const h = (d.value / max) * (H - 2 * M);
        return (
          <g key={i}>
            <rect x={M + i * bw + bw * 0.12} y={H - M - h} width={bw * 0.76} height={Math.max(h, 0.5)} rx="1.5" fill={color} opacity="0.85">
              <title>{`${d.label}: ${d.value.toFixed(2)} ${unit}`}</title>
            </rect>
            {i % labelEvery === 0 && (
              <text x={M + i * bw + bw / 2} y={H - M + 12} textAnchor="middle" fontSize="8" fill="#64748b">{d.label}</text>
            )}
          </g>
        );
      })}
      <text x={M} y={14} fontSize="9" fill="#94a3b8">max {max.toFixed(1)} {unit}</text>
      <line x1={M} y1={H - M} x2={W - M} y2={H - M} stroke="#cbd5e1" strokeWidth="1" />
    </svg>
  );
}

function EnergyLineChart({ points, unit = "kW", color = "#f59e0b", height = 160, xLabelLeft = "", xLabelRight = "" }) {
  if (!points || points.length < 2) return null;
  const W = 720, H = height, M = 30;
  const maxY = Math.max(...points.map((p) => p.y), 0.001);
  const px = (i) => M + (i / (points.length - 1)) * (W - 2 * M);
  const py = (v) => H - M - (v / maxY) * (H - 2 * M);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: "720px", display: "block" }}>
      <path d={path} fill="none" stroke={color} strokeWidth="2" />
      <line x1={M} y1={H - M} x2={W - M} y2={H - M} stroke="#cbd5e1" strokeWidth="1" />
      <text x={M} y={14} fontSize="9" fill="#94a3b8">max {maxY.toFixed(1)} {unit}</text>
      <text x={M} y={H - 8} fontSize="8" fill="#64748b">{xLabelLeft}</text>
      <text x={W - M} y={H - 8} fontSize="8" fill="#64748b" textAnchor="end">{xLabelRight}</text>
    </svg>
  );
}

const ENERGY_MAPPING_FIELDS = [
  ["timestamp", "Timestamp column", true],
  ["kw", "kW column", false],
  ["kwh", "kWh column", false],
  ["voltage", "Voltage column (optional)", false],
  ["current", "Current column (optional)", false],
  ["powerFactor", "Power factor (optional)", false],
];

function EnergyDataImport({ project, setProject, draftLoadItemsV2, setDraftLoadItemsV2, setHasUnappliedLoadChanges, showToast, setActive }) {
  const [rawHeaders, setRawHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mapping, setMapping] = useState(null);
  const [sourceLabel, setSourceLabel] = useState("Data logger");
  const [fileName, setFileName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [surveyMessages, setSurveyMessages] = useState([]);
  const [sizingBasis, setSizingBasis] = useState("average_profile");

  const ingestTable = (headers, rows, label) => {
    setRawHeaders(headers);
    setRawRows(rows);
    setMapping(autoDetectMapping(headers));
    if (label) setFileName(label);
  };

  const readWorkbookRows = async (arrayBuffer) => {
    // v11.3: xlsx (~370 kB min) is code-split — fetched only when an Excel
    // file is actually opened, keeping the first-load bundle small.
    const XLSX = await import("xlsx");
    const wb = XLSX.read(arrayBuffer, { type: "array", sheetRows: MAX_ENERGY_IMPORT_ROWS + 2 });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
    if (aoa.length === 0) return { headers: [], rows: [] };
    if (aoa.length > MAX_ENERGY_IMPORT_ROWS + 1) {
      throw new Error(`Spreadsheet exceeds the ${MAX_ENERGY_IMPORT_ROWS.toLocaleString()} row import limit.`);
    }
    const headers = aoa[0].map((h) => String(h).trim());
    const rows = aoa.slice(1).map((cells) => {
      const row = {};
      headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
      return row;
    });
    return { headers, rows };
  };

  const onFile = async (e, forSurvey = false) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (file.size > MAX_ENERGY_IMPORT_BYTES) {
      showToast("Energy import files must be 10 MiB or smaller.", "error");
      return;
    }
    try {
      let headers = [], rows = [];
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        ({ headers, rows } = await readWorkbookRows(await file.arrayBuffer()));
      } else {
        ({ headers, rows } = parseCsvText(await file.text()));
      }
      if (rows.length === 0) { showToast("No data rows found in the file.", "error"); return; }
      if (forSurvey) {
        importSurveyRows(rows, file.name);
      } else {
        ingestTable(headers, rows, file.name);
        showToast(`Loaded ${rows.length} rows from ${file.name} — check the column mapping below.`);
      }
    } catch (err) {
      showToast(`Could not read file: ${err.message}`, "error");
    }
  };

  const onPaste = () => {
    const { headers, rows } = parseCsvText(pasteText);
    if (rows.length === 0) { showToast("Pasted text has no data rows — include a header line.", "error"); return; }
    ingestTable(headers, rows, "pasted table");
    showToast(`Parsed ${rows.length} pasted rows — check the column mapping below.`);
  };

  // ── Derived analysis (all pure functions from energyImportEngine) ──
  const hasMapping = mapping && mapping.timestamp && (mapping.kw || mapping.kwh);
  const quality = useMemo(() => {
    if (!hasMapping || rawRows.length === 0) return null;
    return cleanEnergyProfile(normalizeEnergyRows(rawRows, mapping));
  }, [rawRows, mapping, hasMapping]);
  const profile = useMemo(
    () => (quality && quality.cleanedRows.length > 0 ? analyseLoadProfile(quality.cleanedRows, quality.detectedIntervalMinutes) : null),
    [quality]
  );
  const recommendation = useMemo(
    () => (profile ? generateSizingFromLoadProfile(profile, project, sizingBasis) : null),
    [profile, project, sizingBasis]
  );

  // ── Apply actions (draft-only; Update Sizing still commits) ──
  const persistSummary = (extra = {}) => {
    const summary = buildEnergyImportSummary(quality, profile, sourceLabel);
    setProject((p) => ({ ...p, energyImport: summary, loadSource: "data_logger", billSource: "data_logger", dataConfidence: profile.profileConfidence, ...extra }));
    return summary;
  };

  const generateDraftLoads = (basis = sizingBasis, alsoSetBill = false) => {
    if (!profile) return;
    let rows = generateSyntheticLoads(profile);
    if (basis === "conservative_peak") {
      rows = rows.map((r) => (r.name.includes("Base load") ? r : { ...r, ratedW: Math.round(r.ratedW * 1.15) }));
    }
    setDraftLoadItemsV2(rows);
    setHasUnappliedLoadChanges(true);
    const extra = alsoSetBill && (project.gridTariff || 0) > 0
      ? { monthlyBill: Math.round(profile.monthlyKwhEstimate * project.gridTariff) }
      : {};
    persistSummary(extra);
    showToast("Data logger profile converted to draft loads. Review and click Update Sizing.");
  };

  const exportSummary = () => {
    if (!profile || !quality) return;
    const lines = [
      `Voltflow load profile summary — ${project.client || "project"}`,
      `Source,${sourceLabel} (${fileName})`,
      `Date range,${quality.dateRange.start} → ${quality.dateRange.end} (${quality.dateRange.days} days)`,
      `Records,${quality.totalRecords} raw / ${quality.cleanedRows.length} cleaned @ ${quality.detectedIntervalMinutes} min`,
      `Data quality score,${quality.dataQualityScore}/100`,
      `Average daily kWh,${profile.averageDailyKwh}`,
      `Max / min daily kWh,${profile.maxDailyKwh} / ${profile.minDailyKwh}`,
      `Weekday / weekend avg kWh,${profile.weekdayAverageKwh} / ${profile.weekendAverageKwh}`,
      `Peak / P95 / average demand kW,${profile.peakDemandKw} / ${profile.p95DemandKw} / ${profile.averageDemandKw}`,
      `Base load kW,${profile.baseLoadKw}`,
      `Day / night kWh,${profile.dayKwh} (${profile.dayNightSplit.dayPct}%) / ${profile.nightKwh} (${profile.dayNightSplit.nightPct}%)`,
      `Load factor,${profile.loadFactor}`,
      `Estimated monthly / annual kWh,${profile.monthlyKwhEstimate} / ${profile.annualKwhEstimate}`,
      `Profile confidence,${profile.profileConfidence}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(project.client || "project").replace(/[^a-z0-9]/gi, "_").toLowerCase()}_load_profile_summary.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── Energy survey template ──
  const downloadTemplate = () => {
    const blob = new Blob([buildEnergySurveyTemplateCsv()], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "voltflow_energy_survey_template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importSurveyRows = (rows, label) => {
    const { items, errors } = parseEnergySurveyRows(rows);
    setSurveyMessages(errors);
    if (items.length === 0) { showToast("No valid load rows found in the survey template.", "error"); return; }
    setDraftLoadItemsV2(items);
    setHasUnappliedLoadChanges(true);
    setProject((p) => ({ ...p, loadSource: "measured", energyImport: p.energyImport }));
    showToast(`Imported ${items.length} loads from ${label} into the draft table — review and click Update Sizing.`);
  };

  const hourLabels = ["0", "", "", "3", "", "", "6", "", "", "9", "", "", "12", "", "", "15", "", "", "18", "", "", "21", "", ""];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Card title="Energy Data Import" subtitle="Upload a data logger export, interval load profile, or completed energy survey sheet. Analysis produces a sizing basis for the existing load workflow — nothing changes until you click Update Sizing in Load Assessment.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "0.75rem" }}>
          <div className="field-group">
            <span className="field-label">Data source type</span>
            <select className="field-input" value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)}>
              <option>Data logger</option>
              <option>Smart meter export</option>
              <option>Utility interval data</option>
              <option>Energy survey</option>
              <option>Other measured data</option>
            </select>
          </div>
          <div className="field-group">
            <span className="field-label">Upload CSV / XLSX (interval data)</span>
            <input type="file" accept=".csv,.txt,.xlsx,.xls" onChange={(e) => onFile(e, false)} className="field-input" style={{ padding: "0.35rem" }} />
          </div>
        </div>
        <div style={{ marginTop: "0.75rem" }}>
          <div className="field-group">
            <span className="field-label">Or paste a table (header line + rows, comma/semicolon/tab separated)</span>
            <textarea className="field-input" rows={4} value={pasteText} onChange={(e) => setPasteText(e.target.value)}
              placeholder={"timestamp,kW\n2026-06-01 00:00,1.2\n2026-06-01 00:15,1.1"} style={{ fontFamily: "monospace", fontSize: "0.78rem" }} />
          </div>
          <button onClick={onPaste} className="btn btn-secondary" style={{ marginTop: "0.4rem" }}>📋 Parse pasted table</button>
          {fileName && <span style={{ marginLeft: "0.75rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>Loaded: <strong>{fileName}</strong> ({rawRows.length} rows)</span>}
        </div>
      </Card>

      {rawHeaders.length > 0 && (
        <Card title="Column mapping" subtitle="Auto-detected where possible — correct any column the logger names differently.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "0.6rem" }}>
            {ENERGY_MAPPING_FIELDS.map(([key, label, required]) => (
              <div key={key} className="field-group">
                <span className="field-label">{label}{required ? " *" : ""}</span>
                <select className="field-input" value={mapping?.[key] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value || null }))}>
                  <option value="">— none —</option>
                  {rawHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          {!hasMapping && (
            <AlertBox type="warning" style={{ marginTop: "0.6rem" }}>
              Map the timestamp column plus at least one of kW or kWh to run the analysis.
            </AlertBox>
          )}
        </Card>
      )}

      {quality && (
        <Card title="Data quality" subtitle="Cleaning drops unreadable, duplicate, negative and valueless rows before analysis.">
          <div className="grid-cols-4" style={{ marginBottom: "0.75rem" }}>
            <Metric label="Data Quality Score" value={`${quality.dataQualityScore}/100`} good={quality.dataQualityScore >= 70} danger={quality.dataQualityScore < 40} />
            <Metric label="Records" value={`${quality.cleanedRows.length}`} hint={`of ${quality.totalRecords} raw`} />
            <Metric label="Interval" value={`${quality.detectedIntervalMinutes} min`} hint="auto-detected" />
            <Metric label="Date Range" value={`${quality.dateRange.days} days`} hint={quality.dateRange.start ? `${quality.dateRange.start.slice(0, 10)} → ${quality.dateRange.end.slice(0, 10)}` : "—"} />
          </div>
          {quality.validationWarnings.map((w, i) => <SimBadge key={i} level={w.level}>{w.msg}</SimBadge>)}
        </Card>
      )}

      {profile && (
        <>
          <Card title="Load profile analysis" subtitle="Day window 06:00–18:00 · night 18:00–06:00 (site local time).">
            <div className="grid-cols-4" style={{ marginBottom: "0.75rem" }}>
              <Metric label="Average Daily" value={`${num(profile.averageDailyKwh, 1)} kWh`} hint={`min ${num(profile.minDailyKwh, 1)} / max ${num(profile.maxDailyKwh, 1)}`} />
              <Metric label="Peak Demand" value={`${num(profile.peakDemandKw, 2)} kW`} hint={`P95 ${num(profile.p95DemandKw, 2)} kW`} />
              <Metric label="Day Energy" value={`${num(profile.dayKwh, 1)} kWh`} hint={`${profile.dayNightSplit.dayPct}% of total`} />
              <Metric label="Night Energy" value={`${num(profile.nightKwh, 1)} kWh`} hint={`${profile.dayNightSplit.nightPct}% of total`} />
            </div>
            <div className="grid-cols-4">
              <Metric label="Base Load" value={`${num(profile.baseLoadKw, 2)} kW`} hint="P5 demand" />
              <Metric label="Load Factor" value={num(profile.loadFactor, 2)} hint="avg / peak" />
              <Metric label="Weekday / Weekend" value={`${num(profile.weekdayAverageKwh, 1)} / ${num(profile.weekendAverageKwh, 1)}`} hint="kWh per day" />
              <Metric label="Profile Confidence" value={profile.profileConfidence} good={profile.profileConfidence === "High"} danger={profile.profileConfidence === "Low"} />
            </div>
          </Card>

          <Card title="24-hour average load profile" subtitle="Mean kW per hour across the logging period.">
            <EnergyMiniBarChart data={profile.hourlyAverageKw.map((v, h) => ({ label: hourLabels[h], value: v }))} unit="kW" color="#3b82f6" />
          </Card>
          <Card title="Daily energy" subtitle="kWh per calendar day in the logging window.">
            <EnergyMiniBarChart data={profile.dailyTotals.map((d) => ({ label: d.date.slice(8), value: d.kwh }))} unit="kWh" color="#10b981" labelEvery={Math.max(1, Math.ceil(profile.dailyTotals.length / 15))} />
          </Card>
          <div className="grid-cols-2">
            <Card title="Weekday vs weekend" subtitle="Average daily energy.">
              <EnergyMiniBarChart data={[{ label: "Weekday", value: profile.weekdayAverageKwh }, { label: "Weekend", value: profile.weekendAverageKwh }]} unit="kWh" color="#7c3aed" height={140} />
            </Card>
            <Card title="Demand duration curve" subtitle="% of time demand is exceeded.">
              <EnergyLineChart points={profile.durationCurve.map((p) => ({ x: p.pct, y: p.kw }))} unit="kW" color="#ef4444" height={140} xLabelLeft="0% (peak)" xLabelRight="100% (base)" />
            </Card>
          </div>
          {profile.peakDayRows.length > 1 && (
            <Card title={`Peak day profile — ${profile.peakDay?.date} (${num(profile.peakDay?.kwh, 1)} kWh)`} subtitle="Demand through the highest-consumption day.">
              <EnergyLineChart points={profile.peakDayRows.map((r) => ({ x: r.t, y: r.kw }))} unit="kW" color="#f59e0b" xLabelLeft="00:00" xLabelRight="24:00" />
            </Card>
          )}

          <Card title="Suggested sizing basis" subtitle="A suggestion for the existing sizing workflow — the committed design still comes from Load Assessment + Update Sizing, and final engineering requires site verification and licensed review.">
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              {[["average_profile", "Average profile"], ["conservative_peak", "Conservative peak"], ["worst_day", "Worst day"]].map(([v, lbl]) => (
                <button key={v} onClick={() => setSizingBasis(v)}
                  style={{ padding: "0.3rem 0.8rem", borderRadius: "1rem", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                    border: "1.5px solid", borderColor: sizingBasis === v ? "var(--color-primary)" : "#e2e8f0",
                    background: sizingBasis === v ? "var(--color-primary)" : "#fff", color: sizingBasis === v ? "#fff" : "#475569" }}>
                  {lbl}
                </button>
              ))}
            </div>
            {recommendation && (
              <>
                <div className="grid-cols-4" style={{ marginBottom: "0.75rem" }}>
                  <Metric label="Sizing Daily Energy" value={`${num(recommendation.recommendedDailyKwh, 1)} kWh`} />
                  <Metric label="Sizing Peak" value={`${num(recommendation.recommendedPeakKw, 1)} kW`} />
                  <Metric label="Suggested PV" value={`~${num(recommendation.recommendedPvKwp, 1)} kWp`} />
                  <Metric label="Suggested Inverter" value={`~${num(recommendation.recommendedInverterKw, 1)} kW`} />
                </div>
                <div className="grid-cols-4" style={{ marginBottom: "0.75rem" }}>
                  <Metric label="Night Energy Basis" value={`${num(recommendation.recommendedNightKwh, 1)} kWh`} />
                  <Metric label="Suggested Battery" value={`~${num(recommendation.recommendedBatteryKwh, 1)} kWh`} />
                  <Metric label="Backup at Base Load" value={`~${num(recommendation.recommendedBackupHours, 1)} h`} />
                  <Metric label="Critical Load Basis" value={`${num(profile.recommendedCriticalLoadKw, 2)} kW`} />
                </div>
                {recommendation.engineeringNotes.map((n, i) => <SimBadge key={`e${i}`} level="info">{n}</SimBadge>)}
                {recommendation.commercialNotes.map((n, i) => <SimBadge key={`c${i}`} level="info">{n}</SimBadge>)}
              </>
            )}
          </Card>

          <Card title="Apply to project" subtitle="All buttons write DRAFT loads and assumption metadata only — commit happens in Load Assessment via Update Sizing.">
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <button onClick={() => { setSizingBasis("average_profile"); generateDraftLoads("average_profile", true); }} className="btn btn-primary">
                ☀ Use average profile for sizing
              </button>
              <button onClick={() => { setSizingBasis("conservative_peak"); generateDraftLoads("conservative_peak", true); }} className="btn btn-primary">
                🛡 Use conservative peak profile
              </button>
              <button onClick={() => generateDraftLoads(sizingBasis, false)} className="btn btn-secondary">
                ⚙ Generate draft loads from data logger
              </button>
              <button onClick={() => setActive("loads")} className="btn btn-secondary">
                → Send to Load Assessment
              </button>
              <button onClick={exportSummary} className="btn btn-secondary">
                📥 Export load profile summary
              </button>
            </div>
            <div style={{ marginTop: "0.6rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Applying also records the data source on the project (loadSource = data_logger, confidence = {profile.profileConfidence}) for the readiness score and proposal.
              {(project.gridTariff || 0) > 0 && ` "Use … profile" buttons also set the monthly bill to ≈ KES ${nf.format(Math.round(profile.monthlyKwhEstimate * project.gridTariff))} from measured kWh × tariff.`}
            </div>
          </Card>
        </>
      )}

      <Card title="Energy survey template (manual collection)" subtitle="For sites without a logger: download the template, fill it on site or in Excel, then upload it to create draft loads directly.">
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={downloadTemplate} className="btn btn-secondary">📄 Download survey template (CSV)</button>
          <div className="field-group" style={{ minWidth: "240px" }}>
            <span className="field-label">Upload completed template (CSV/XLSX)</span>
            <input type="file" accept=".csv,.txt,.xlsx,.xls" onChange={(e) => onFile(e, true)} className="field-input" style={{ padding: "0.35rem" }} />
          </div>
        </div>
        {surveyMessages.length > 0 && (
          <div style={{ marginTop: "0.6rem" }}>
            {surveyMessages.map((m, i) => <SimBadge key={i} level="warning">{m}</SimBadge>)}
          </div>
        )}
        <div style={{ marginTop: "0.6rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Columns: {["Load name", "Quantity", "Rated watts", "Day hours", "Night hours", "Surge multiplier", "Critical yes/no", "Category", "Notes"].join(" · ")}
        </div>
      </Card>

      <AlertBox type="info">
        Data logger import improves sizing confidence, but final engineering design still requires site verification, equipment confirmation, safety checks and licensed engineering review.
      </AlertBox>
    </div>
  );
}

function LoadAssessment({
  loadAssessmentMode, setLoadAssessmentMode,
  loadItemsV2,            // committed — used by useSizing via toLegacyLoads (read-only here)
  draftLoadItemsV2,       // working copy — all edits go here
  setDraftLoadItemsV2,
  hasUnappliedLoadChanges,
  setHasUnappliedLoadChanges,
  onCommit,               // fn() → commits draftLoadItemsV2 → loadItemsV2
  onReset,                // fn() → discards draft, restores committed loads
  draftLoadErrors,        // validateLoadItemsV2(draft) — invalid rows block commit
  sizingMode, setSizingMode, // existing_site | blueprint_new_build | future_expansion
  blueprint, setBlueprint,
  sizing,                 // derived from committed loads
  loadSummary,            // summarizeLoads() on committed loadItemsV2
  loadWarnings,
  dataLoggerRecommendation,
  loadProfile24h,
  showToast,
  highlightId,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const modeDefaults = getModeDefaults(loadAssessmentMode);
  const presets = useMemo(() => getPresetsForMode(loadAssessmentMode), [loadAssessmentMode]);
  const draftSummary = useMemo(() => summarizeLoads(draftLoadItemsV2, loadAssessmentMode), [draftLoadItemsV2, loadAssessmentMode]);
  const errorById = useMemo(() => {
    const m = {};
    (draftLoadErrors || []).forEach((e) => { m[e.id] = e.problems; });
    return m;
  }, [draftLoadErrors]);
  const hasInvalidRows = (draftLoadErrors || []).length > 0;

  const updateDraft = (id, key, value) => {
    setDraftLoadItemsV2((rows) => rows.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
    setHasUnappliedLoadChanges(true);
  };
  const addLoad = (overrides = {}) => {
    setDraftLoadItemsV2((rows) => [...rows, createLoadItem(overrides)]);
    setHasUnappliedLoadChanges(true);
    if (showToast) showToast(`Added "${overrides.name || "load"}" to the list — click Update Sizing to apply.`);
  };
  const removeLoad = (id) => {
    setDraftLoadItemsV2((rows) => rows.filter((l) => l.id !== id));
    setHasUnappliedLoadChanges(true);
    if (expandedId === id) setExpandedId(null);
  };
  const duplicateLoad = (id) => {
    setDraftLoadItemsV2((rows) => {
      const idx = rows.findIndex((l) => l.id === id);
      if (idx < 0) return rows;
      const copy = createLoadItem({ ...rows[idx], name: `${rows[idx].name} (copy)` });
      return [...rows.slice(0, idx + 1), copy, ...rows.slice(idx + 1)];
    });
    setHasUnappliedLoadChanges(true);
  };

  const statusBanner = hasInvalidRows
    ? { bg: "#fef2f2", border: "#fca5a5", color: "#7f1d1d", icon: "⛔", msg: `Some loads are invalid — fix the ${draftLoadErrors.length} highlighted row(s) before updating sizing.` }
    : hasUnappliedLoadChanges
    ? { bg: "#fef3c7", border: "#fcd34d", color: "#78350f", icon: "⚠", msg: "You have unapplied load changes — click Update Sizing to recalculate PV, battery, BoQ and proposal." }
    : { bg: "#ecfdf5", border: "#6ee7b7", color: "#065f46", icon: "✓", msg: "All load changes applied — sizing is up to date." };

  const bp = blueprint || {};
  const bpTemplate = BLUEPRINT_TEMPLATES.find((t) => t.key === bp.buildingType) || BLUEPRINT_TEMPLATES[0];
  const generateFromBlueprint = () => {
    const generated = generateBlueprintDraftLoads(bp.buildingType, bp);
    setDraftLoadItemsV2(generated);
    setHasUnappliedLoadChanges(true);
    if (showToast) showToast(`Generated ${generated.length} draft loads from the "${bpTemplate.label}" template — review, then click Update Sizing to apply.`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Card title="Sizing basis" subtitle="How this project's loads are established. Blueprint and future-expansion projects carry extra assumptions into the proposal.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          {[["existing_site", "🏠 Existing site"], ["blueprint_new_build", "📐 Blueprint / new build"], ["future_expansion", "📈 Future expansion"]].map(([v, lbl]) => (
            <button key={v} onClick={() => setSizingMode && setSizingMode(v)}
              style={{ padding: "0.35rem 0.9rem", borderRadius: "1rem", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                border: "1.5px solid", borderColor: sizingMode === v ? "var(--color-primary)" : "#e2e8f0",
                background: sizingMode === v ? "var(--color-primary)" : "#fff",
                color: sizingMode === v ? "#fff" : "#475569" }}>
              {lbl}
            </button>
          ))}
        </div>
        {sizingMode !== "existing_site" && (
          <div style={{ marginTop: "0.6rem", fontSize: "0.78rem", color: "#92400e", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "0.4rem", padding: "0.45rem 0.75rem" }}>
            ⚠ {sizingMode === "blueprint_new_build"
              ? "Blueprint stage: loads below are assumptions, not measurements. Final sizing must be reviewed once the equipment schedule / MEP drawings are confirmed."
              : "Future expansion: sizing includes planned growth beyond today's measured loads. Confirm the growth assumptions with the client."}
          </div>
        )}
      </Card>

      {sizingMode !== "existing_site" && (
        <Card title="Blueprint / new-construction template"
          subtitle="Generate a starter load list from the building design. Generated loads go to the DRAFT table only — nothing changes until you click Update Sizing.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.6rem", marginBottom: "0.75rem" }}>
            <div className="field-group">
              <span className="field-label">Building type</span>
              <select className="field-input" value={bp.buildingType || "residential_house"} onChange={(e) => setBlueprint({ buildingType: e.target.value })}>
                {BLUEPRINT_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div className="field-group">
              <span className="field-label">Floor area (m²)</span>
              <input type="number" className="field-input" value={bp.floorAreaM2 ?? 150} onChange={(e) => setBlueprint({ floorAreaM2: Math.max(0, Number(e.target.value) || 0) })} />
            </div>
            <div className="field-group">
              <span className="field-label">Occupancy (people/rooms)</span>
              <input type="number" className="field-input" value={bp.occupancy ?? 4} onChange={(e) => setBlueprint({ occupancy: Math.max(1, Math.round(Number(e.target.value) || 1)) })} />
            </div>
            <div className="field-group">
              <span className="field-label">Operating hours / day</span>
              <input type="number" className="field-input" value={bp.scheduleHoursPerDay ?? 10} onChange={(e) => setBlueprint({ scheduleHoursPerDay: clamp(e.target.value, 1, 24) })} />
            </div>
            <div className="field-group">
              <span className="field-label">Future growth margin (%)</span>
              <input type="number" className="field-input" value={bp.futureGrowthPct ?? 15} onChange={(e) => setBlueprint({ futureGrowthPct: clamp(e.target.value, 0, 100) })} />
            </div>
            <div className="field-group">
              <span className="field-label">Confidence level</span>
              <select className="field-input" value={bp.confidenceLevel || "medium"} onChange={(e) => setBlueprint({ confidenceLevel: e.target.value })}>
                <option value="low">Low — concept stage</option>
                <option value="medium">Medium — drawings available</option>
                <option value="high">High — equipment schedule confirmed</option>
              </select>
            </div>
          </div>
          <div className="field-group" style={{ marginBottom: "0.75rem" }}>
            <span className="field-label">Blueprint notes (equipment schedule refs, MEP drawing numbers…)</span>
            <input className="field-input" value={bp.notes || ""} onChange={(e) => setBlueprint({ notes: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={generateFromBlueprint} className="btn btn-primary">📐 Generate draft loads from template</button>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Replaces the current draft table. Use Reset Changes to restore the applied loads if needed.
            </span>
          </div>
        </Card>
      )}

      <Card title="Load assessment mode" subtitle="Sets presets, demand/diversity assumptions, warnings and proposal language for the rest of this page.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          {LOAD_MODES.map((m) => (
            <button key={m.value} onClick={() => setLoadAssessmentMode(m.value)}
              style={{ padding: "0.35rem 0.8rem", borderRadius: "1rem", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                border: "1.5px solid", borderColor: loadAssessmentMode === m.value ? "var(--color-primary)" : "#e2e8f0",
                background: loadAssessmentMode === m.value ? "var(--color-primary)" : "#fff",
                color: loadAssessmentMode === m.value ? "#fff" : "#475569" }}>
              {m.label}
            </button>
          ))}
        </div>
        <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#64748b" }}>
          {modeDefaults.proposalLanguage} Default demand factor <strong>{modeDefaults.demandFactorPct}%</strong>, diversity factor <strong>{modeDefaults.diversityFactorPct}%</strong> (override per item below if you have better data).
        </div>
      </Card>

      <Card title="Quick presets" subtitle={`Click to add a typical ${loadAssessmentMode} load — edit quantity/hours after adding.`}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          {presets.map((p, i) => (
            <button key={i} onClick={() => addLoad(p)}
              style={{ padding: "0.3rem 0.7rem", borderRadius: "1rem", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569" }}>
              + {p.name}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Load table"
        subtitle="Edit loads below. Click '⚙' to set phase/PF/starting method/demand/diversity. Click 'Update Sizing' to commit changes to PV, battery, BoQ and financial results.">

        <div style={{ background: statusBanner.bg, border: `1px solid ${statusBanner.border}`, color: statusBanner.color, borderRadius: "0.5rem", padding: "0.6rem 1rem", marginBottom: "0.75rem", fontSize: "0.83rem", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
          <span>{statusBanner.icon} {statusBanner.msg}</span>
          {hasUnappliedLoadChanges && !hasInvalidRows && (
            <button onClick={onCommit} className="btn btn-primary" style={{ fontSize: "0.8rem", padding: "0.35rem 1rem" }}>
              ⚡ Update Sizing
            </button>
          )}
        </div>

        <div style={{ marginBottom: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>
          Metrics below reflect the last committed loads. Edit the table and click Update Sizing to refresh.
        </div>
        <div className="grid-cols-4" style={{ marginBottom: "1rem" }}>
          <Metric label="Solar Connected Load" value={`${num(loadSummary.connectedKw, 2)} kW`} hint="Solar + backup scopes" />
          <Metric label="Max Demand" value={`${num(loadSummary.maxDemandKw, 2)} kW`} hint="Demand × diversity" />
          <Metric label="Solar Daily Energy" value={`${num(loadSummary.solar_daily_kwh, 2)} kWh`} hint={`Day ${num(loadSummary.dayKwh, 1)} / Night ${num(loadSummary.nightKwh, 1)}`} />
          <Metric label="Peak with Surge" value={`${num(sizing.peakKw, 2)} kW`} hint="Inverter basis" />
        </div>
        <div className="grid-cols-4" style={{ marginBottom: "1rem" }}>
          <Metric label="Site Daily Energy" value={`${num(loadSummary.site_daily_kwh, 2)} kWh`} hint="Includes grid-only; excludes survey-only" />
          <Metric label="Backup Daily Energy" value={`${num(loadSummary.backup_daily_kwh, 2)} kWh`} hint="Battery energy scope" />
          <Metric label="Site / Solar Peak" value={`${num(loadSummary.site_peak_kw, 2)} / ${num(loadSummary.solar_peak_kw, 2)} kW`} />
          <Metric label="3-Phase Peak" value={`${num(loadSummary.three_phase_peak_kw, 2)} kW`} hint="Phase capability check" />
        </div>
        <div className="grid-cols-4" style={{ marginBottom: "1rem" }}>
          <Metric label="Critical / Backup kWh" value={`${num(loadSummary.criticalKwh, 2)} kWh`} hint={`${pct2(loadSummary.criticalFraction)} of daily`} />
          <Metric label="Solar-offset-only kWh" value={`${num(loadSummary.solarOffsetOnlyKwh, 2)} kWh`} hint="Not backed up" />
          <Metric label="Load Factor" value={num(loadSummary.loadFactor, 2)} hint="Avg / peak" />
          <Metric label="Largest Motor" value={loadSummary.largestMotorName || "—"} hint={loadSummary.largestMotorStartingKva ? `${num(loadSummary.largestMotorStartingKva, 1)} kVA start` : "None identified"} />
        </div>

        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.4rem", padding: "0.5rem 0.85rem", marginBottom: "0.85rem", fontSize: "0.82rem", color: "#475569", display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
          <span>✏ Draft daily: <strong style={{ color: "#0f172a" }}>{num(draftSummary.dailyKwh, 2)} kWh</strong></span>
          <span>✏ Draft demand: <strong style={{ color: "#0f172a" }}>{num(draftSummary.maxDemandKw, 2)} kW</strong></span>
          <span>✏ Draft critical: <strong style={{ color: "#0f172a" }}>{num(draftSummary.criticalKwh, 2)} kWh</strong></span>
          <span>✏ Items: <strong style={{ color: "#0f172a" }}>{draftLoadItemsV2.length}</strong></span>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th></th>
                <th>Load name</th>
                <th>Qty</th>
                <th>Rated W</th>
                <th>Phase</th>
                <th>Day h</th>
                <th>Night h</th>
                <th>Powered by</th>
                <th>Day kWh</th>
                <th>Night kWh</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {draftLoadItemsV2.map((item) => (
                <LoadRow key={item.id} item={item} modeDefaults={modeDefaults}
                  expanded={expandedId === item.id}
                  onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  onUpdate={updateDraft} onRemove={removeLoad} onDuplicate={duplicateLoad}
                  problems={errorById[item.id]} />
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "var(--bg-dark)", color: "#fff" }}>
                <td colSpan={8} style={{ padding: "0.5rem 1rem", fontWeight: 700, fontSize: "0.8rem" }}>Draft totals</td>
                <td style={{ padding: "0.5rem", fontWeight: 800, color: "#6ee7b7" }}>{num(draftSummary.dayKwh, 2)} kWh</td>
                <td style={{ padding: "0.5rem", fontWeight: 800, color: "#6ee7b7" }}>{num(draftSummary.nightKwh, 2)} kWh</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => addLoad()} className="btn btn-primary">+ Add Load</button>
          <button
            onClick={onCommit}
            disabled={hasInvalidRows}
            data-highlight="update-sizing-btn"
            className={`btn ${hasUnappliedLoadChanges && !hasInvalidRows ? "btn-accent" : "btn-secondary"} ${highlightClass(highlightId, "update-sizing-btn")}`}
            style={{ fontWeight: hasUnappliedLoadChanges ? 800 : 600, opacity: hasInvalidRows ? 0.55 : 1, cursor: hasInvalidRows ? "not-allowed" : "pointer" }}
            title={hasInvalidRows ? "Fix the highlighted invalid rows first" : undefined}
          >
            {hasInvalidRows ? "⛔ Fix invalid loads" : hasUnappliedLoadChanges ? "⚡ Update Sizing" : "✓ Sizing up to date"}
          </button>
          {hasUnappliedLoadChanges && (
            <button onClick={onReset} className="btn btn-secondary" title="Discard draft edits and restore the applied loads">
              ↺ Reset Changes
            </button>
          )}
          {hasUnappliedLoadChanges && !hasInvalidRows && (
            <span style={{ fontSize: "0.78rem", color: "#92400e", fontWeight: 600 }}>
              ⚠ Changes not yet applied to sizing
            </span>
          )}
        </div>
      </Card>

      <SpecialCalculatorsPanel onAddLoad={addLoad} />

      <Card title="24-hour load profile" subtitle="Planning visual — see disclaimer below the chart.">
        <LoadProfileChart profile={loadProfile24h} />
      </Card>

      <Card title="Load quality warnings" subtitle="Address danger-level items before finalising sizing.">
        {loadWarnings.length === 0 && <SimBadge level="success">No load quality warnings for the current configuration.</SimBadge>}
        {loadWarnings.map((w, i) => <SimBadge key={i} level={w.level}>{w.msg}</SimBadge>)}
      </Card>

      {dataLoggerRecommendation && (
        <Card title="Data logger recommendation" subtitle="Recommended for commercial/industrial sizing confidence.">
          <SimBadge level="info">{dataLoggerRecommendation.note}</SimBadge>
          <div style={{ fontSize: "0.8rem", color: "#475569", marginTop: "0.5rem" }}>
            Capture: {dataLoggerRecommendation.capture.join(", ")}.
          </div>
        </Card>
      )}
    </div>
  );
}

function pct2(v) { return `${((Number(v) || 0) * 100).toFixed(0)}%`; }

function LoadRow({ item, modeDefaults, expanded, onToggleExpand, onUpdate, onRemove, onDuplicate, problems }) {
  const d = computeItemDerived(item, modeDefaults);
  const invalid = Array.isArray(problems) && problems.length > 0;
  // v11.5.1 — soft warning when a single load runs more than 24 h/day total.
  const hoursTotal = (Number(item.dayHours) || 0) + (Number(item.nightHours) || 0);
  const hoursOver = hoursTotal > 24;
  const blankQtyOrWatts = !(Number(item.qty) >= 1) || !(Number(item.ratedW) > 0);
  const tdNum = { width: "72px" };

  return (
    <>
      <tr style={invalid ? { background: "#fef2f2", outline: "1.5px solid #fca5a5", outlineOffset: "-1.5px" } : undefined}
        title={invalid ? `Invalid: ${problems.join("; ")}` : undefined}>
        <td>
          <button onClick={onToggleExpand} title="Advanced fields" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "0.85rem", color: "var(--color-primary)" }}>
            {expanded ? "▾" : "▸"} ⚙
          </button>
        </td>
        <td>
          <input className="table-input" value={item.name} onChange={(e) => onUpdate(item.id, "name", e.target.value)} />
        </td>
        <td>
          <SmartNumberField className="table-input" style={tdNum} min={0} emptyValue={0}
            value={item.qty} onChange={(v) => onUpdate(item.id, "qty", v)} />
        </td>
        <td>
          <SmartNumberField className="table-input" style={{ width: "84px" }} min={0} emptyValue={0}
            value={item.ratedW} onChange={(v) => onUpdate(item.id, "ratedW", v)} />
        </td>
        <td>
          <select className="select-input" style={{ width: "112px" }} value={item.phase} onChange={(e) => onUpdate(item.id, "phase", e.target.value)}>
            <option value="SINGLE_PHASE">Single phase</option>
            <option value="THREE_PHASE">Three phase</option>
            <option value="DC">DC</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
        </td>
        <td>
          <SmartNumberField className="table-input" style={{ width: "68px" }} min={0} max={24} emptyValue={0}
            value={item.dayHours} onChange={(v) => onUpdate(item.id, "dayHours", v)} />
        </td>
        <td>
          <SmartNumberField className="table-input" style={{ width: "68px" }} min={0} max={24} emptyValue={0}
            value={item.nightHours} onChange={(v) => onUpdate(item.id, "nightHours", v)} />
        </td>
        <td>
          <select className="select-input" style={{ width: "118px" }} value={normalizeSupplyScope(item)} onChange={(e) => onUpdate(item.id, "supply_scope", e.target.value)}>
            <option value="SOLAR">Solar</option>
            <option value="BACKUP">Backup</option>
            <option value="GRID_ONLY">Grid only</option>
            <option value="EXCLUDED">Excluded</option>
          </select>
        </td>
        <td className="font-bold" style={{ color: "var(--color-primary)" }}>{num(d.dayKwh, 2)}</td>
        <td className="font-bold" style={{ color: "var(--color-primary)" }}>{num(d.nightKwh, 2)}</td>
        <td>
          <div style={{ display: "flex", gap: "0.25rem" }}>
            <button onClick={() => onDuplicate && onDuplicate(item.id)} className="btn btn-secondary" title="Duplicate this load" style={{ padding: "0.25rem 0.5rem" }}>⧉</button>
            <button onClick={() => onRemove(item.id)} className="btn btn-danger" style={{ padding: "0.25rem 0.6rem" }}>✕</button>
          </div>
        </td>
      </tr>
      {invalid && (
        <tr>
          <td colSpan={11} style={{ background: "#fef2f2", color: "#7f1d1d", fontSize: "0.75rem", padding: "0.25rem 1rem", borderBottom: "1px solid #fca5a5" }}>
            ⛔ {problems.join(" · ")}
          </td>
        </tr>
      )}
      {!invalid && (hoursOver || blankQtyOrWatts) && (
        <tr>
          <td colSpan={11} style={{ background: "#fffbeb", color: "#78350f", fontSize: "0.74rem", padding: "0.2rem 1rem", borderBottom: "1px solid #fcd34d" }}>
            {hoursOver && `⚠ Day + night hours total ${num(hoursTotal, 1)} h — more than 24 h in a day. `}
            {blankQtyOrWatts && "⚠ Quantity and rated watts should both be filled in."}
          </td>
        </tr>
      )}
      {expanded && (
        <tr>
          <td colSpan={11} style={{ background: "#f8fafc", padding: "0.85rem 1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.6rem" }}>
              <div className="field-group">
                <span className="field-label">Category</span>
                <input className="field-input" value={item.category} onChange={(e) => onUpdate(item.id, "category", e.target.value)} />
              </div>
              <div className="field-group">
                <span className="field-label">Voltage (V)</span>
                <SmartNumberField className="field-input" min={0} emptyValue={0} value={item.voltage} onChange={(v) => onUpdate(item.id, "voltage", v)} />
              </div>
              <div className="field-group">
                <span className="field-label">Power factor</span>
                <SmartNumberField className="field-input" min={0} max={1} step="0.01" emptyValue={1} value={item.powerFactor} onChange={(v) => onUpdate(item.id, "powerFactor", v)} />
              </div>
              <div className="field-group">
                <span className="field-label">Surge ×</span>
                <input type="number" step="0.1" min="1" className="field-input" value={item.surgeMultiplier} onChange={(e) => onUpdate(item.id, "surgeMultiplier", Math.max(1, Number(e.target.value) || 1))} />
              </div>
              <div className="field-group">
                <span className="field-label">Starting method</span>
                <select className="select-input" value={item.startingMethod} onChange={(e) => onUpdate(item.id, "startingMethod", e.target.value)}>
                  {STARTING_METHODS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field-group">
                <span className="field-label">Criticality</span>
                <select className="select-input" value={item.criticality || "ESSENTIAL"} onChange={(e) => onUpdate(item.id, "criticality", e.target.value)}>
                  <option value="CRITICAL">Critical</option>
                  <option value="ESSENTIAL">Essential</option>
                  <option value="NON_CRITICAL">Non-critical</option>
                </select>
              </div>
              <div className="field-group">
                <span className="field-label">Duty cycle %</span>
                <input type="number" min="0" max="100" className="field-input" value={item.dutyCyclePct} onChange={(e) => onUpdate(item.id, "dutyCyclePct", clamp(e.target.value, 0, 100))} />
              </div>
              <div className="field-group">
                <span className="field-label">Demand % (blank = mode default)</span>
                <input type="number" min="0" max="100" className="field-input" placeholder={`${modeDefaults.demandFactorPct}`}
                  value={item.demandFactorPct ?? ""} onChange={(e) => onUpdate(item.id, "demandFactorPct", e.target.value === "" ? undefined : clamp(e.target.value, 0, 100))} />
              </div>
              <div className="field-group">
                <span className="field-label">Diversity % (blank = mode default)</span>
                <input type="number" min="0" max="100" className="field-input" placeholder={`${modeDefaults.diversityFactorPct}`}
                  value={item.diversityFactorPct ?? ""} onChange={(e) => onUpdate(item.id, "diversityFactorPct", e.target.value === "" ? undefined : clamp(e.target.value, 0, 100))} />
              </div>
              {[
                ["essential", "Essential"], ["solarOffsetOnly", "Solar-offset only"],
                ["motorLoad", "Motor load"], ["heavyLoad", "Heavy load"],
                ["criticalProcess", "Critical process"], ["seasonal", "Seasonal"],
              ].map(([key, label]) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!item[key]} onChange={(e) => onUpdate(item.id, key, e.target.checked)} />
                  {label}
                </label>
              ))}
              <div className="field-group" style={{ gridColumn: "span 2" }}>
                <span className="field-label">Notes</span>
                <input className="field-input" value={item.notes} onChange={(e) => onUpdate(item.id, "notes", e.target.value)} />
              </div>
              {["GRID_ONLY", "EXCLUDED"].includes(normalizeSupplyScope(item)) && (
                <div className="field-group" style={{ gridColumn: "span 2" }}>
                  <span className="field-label">Exclusion / grid-only reason</span>
                  <input className="field-input" value={item.exclusion_reason || ""} onChange={(e) => onUpdate(item.id, "exclusion_reason", e.target.value)} />
                </div>
              )}
            </div>
            <div style={{ marginTop: "0.6rem", fontSize: "0.78rem", color: "#64748b" }}>
              Derived: {num(d.apparentKva, 2)} kVA · {num(d.runningCurrentA, 1)} A running · {num(d.startingCurrentA, 1)} A starting
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function SpecialCalculatorsPanel({ onAddLoad }) {
  const [open, setOpen] = useState(null);
  const calcs = [
    { id: "motor", label: "⚙ Motor Load" },
    { id: "pumping", label: "💧 Pumping Load" },
    { id: "coldroom", label: "❄ Cold Room / Refrigeration" },
    { id: "hvac", label: "🌬 HVAC / AC" },
    { id: "genset", label: "⛽ Generator Hybrid" },
  ];
  return (
    <Card title="Special load calculators" subtitle="Each calculator can add its result straight to the load table above.">
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem" }}>
        {calcs.map((c) => (
          <button key={c.id} onClick={() => setOpen(open === c.id ? null : c.id)}
            style={{ padding: "0.4rem 0.85rem", borderRadius: "0.4rem", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
              border: "none", background: open === c.id ? "var(--color-primary)" : "#f1f5f9", color: open === c.id ? "#fff" : "#475569" }}>
            {c.label}
          </button>
        ))}
      </div>
      {open === "motor" && <MotorCalculator onAddLoad={onAddLoad} />}
      {open === "pumping" && <PumpingCalculator onAddLoad={onAddLoad} />}
      {open === "coldroom" && <ColdRoomCalculator onAddLoad={onAddLoad} />}
      {open === "hvac" && <HvacCalculator onAddLoad={onAddLoad} />}
      {open === "genset" && <GeneratorHybridCalculator />}
    </Card>
  );
}

function CalcField({ label, value, onChange, type = "number", options, step = "any" }) {
  return (
    <div className="field-group">
      <span className="field-label">{label}</span>
      {options ? (
        <select className="select-input" value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} step={step} className="field-input" value={value} onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)} />
      )}
    </div>
  );
}

function MotorCalculator({ onAddLoad }) {
  const [inputs, setInputs] = useState({ kw: 5.5, hp: 0, voltage: 400, phase: "three", powerFactor: 0.85, efficiency: 0.9, startingMethod: "DOL", qty: 1, hoursPerDay: 8 });
  const set = (k, v) => setInputs((s) => ({ ...s, [k]: v }));
  const result = useMemo(() => calcMotorLoad(inputs), [inputs]);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.6rem" }}>
        <CalcField label="Motor kW" value={inputs.kw} onChange={(v) => set("kw", v)} />
        <CalcField label="or HP" value={inputs.hp} onChange={(v) => set("hp", v)} />
        <CalcField label="Voltage" value={inputs.voltage} onChange={(v) => set("voltage", v)} />
        <CalcField label="Phase" value={inputs.phase} onChange={(v) => set("phase", v)} options={["single", "three"]} />
        <CalcField label="Power factor" value={inputs.powerFactor} onChange={(v) => set("powerFactor", v)} step="0.01" />
        <CalcField label="Efficiency" value={inputs.efficiency} onChange={(v) => set("efficiency", v)} step="0.01" />
        <CalcField label="Starting method" value={inputs.startingMethod} onChange={(v) => set("startingMethod", v)} options={STARTING_METHODS} />
        <CalcField label="Quantity" value={inputs.qty} onChange={(v) => set("qty", v)} />
        <CalcField label="Operating hours/day" value={inputs.hoursPerDay} onChange={(v) => set("hoursPerDay", v)} />
      </div>
      <div style={{ marginTop: "0.75rem", display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.85rem" }}>
        <span>Running: <strong>{num(result.runningCurrentA, 1)} A / {num(result.runningKva, 2)} kVA</strong></span>
        <span>Starting: <strong>{num(result.startingCurrentA, 1)} A / {num(result.startingKva, 2)} kVA</strong></span>
        <span>Daily energy: <strong>{num(result.dailyKwh, 2)} kWh</strong></span>
        <span>Recommended inverter surge: <strong>{num(result.recommendedInverterSurgeKva, 2)} kVA</strong></span>
      </div>
      <SimBadge level={result.vfdRecommended ? "warning" : "info"}>{result.recommendation}</SimBadge>
      <button className="btn btn-primary" style={{ marginTop: "0.5rem" }} onClick={() => onAddLoad(result.suggestedLoadItem)}>+ Add to load list</button>
    </div>
  );
}

function PumpingCalculator({ onAddLoad }) {
  const [inputs, setInputs] = useState({ pumpKw: 1.1, hoursPerDay: 4, headM: 30, flowM3h: 5, pumpType: "Borehole submersible", startingMethod: "Star-Delta", daytimeOnly: true });
  const set = (k, v) => setInputs((s) => ({ ...s, [k]: v }));
  const result = useMemo(() => calcPumpingLoad(inputs), [inputs]);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.6rem" }}>
        <CalcField label="Pump power (kW)" value={inputs.pumpKw} onChange={(v) => set("pumpKw", v)} />
        <CalcField label="Hours/day" value={inputs.hoursPerDay} onChange={(v) => set("hoursPerDay", v)} />
        <CalcField label="Head (m)" value={inputs.headM} onChange={(v) => set("headM", v)} />
        <CalcField label="Flow (m³/h)" value={inputs.flowM3h} onChange={(v) => set("flowM3h", v)} />
        <CalcField label="Starting method" value={inputs.startingMethod} onChange={(v) => set("startingMethod", v)} options={STARTING_METHODS} />
        <CalcField label="Daytime-only operation" value={inputs.daytimeOnly ? "yes" : "no"} onChange={(v) => set("daytimeOnly", v === "yes")} options={["yes", "no"]} />
      </div>
      <div style={{ marginTop: "0.75rem", display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.85rem" }}>
        <span>Daily energy: <strong>{num(result.dailyKwh, 2)} kWh</strong></span>
        <span>Solar pumping suitable: <strong>{result.solarPumpingSuitable ? "Yes" : "No"}</strong></span>
        <span>VFD recommended: <strong>{result.vfdRecommended ? "Yes" : "No"}</strong></span>
        <span>Suggested window: <strong>{result.suggestedOperationWindow}</strong></span>
      </div>
      <SimBadge level="info">{result.recommendation}</SimBadge>
      <button className="btn btn-primary" style={{ marginTop: "0.5rem" }} onClick={() => onAddLoad(result.suggestedLoadItem)}>+ Add to load list</button>
    </div>
  );
}

function ColdRoomCalculator({ onAddLoad }) {
  const [inputs, setInputs] = useState({ compressorKw: 3, numberOfCompressors: 1, dutyCyclePct: 60, hoursPerDay: 24, setpointC: 2, defrostKwPerDay: 1.5 });
  const set = (k, v) => setInputs((s) => ({ ...s, [k]: v }));
  const result = useMemo(() => calcColdRoomLoad(inputs), [inputs]);
  const supportLabel = { battery: "Battery backup", genset: "Genset support", grid: "Grid support" }[result.recommendedSupport] || result.recommendedSupport;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.6rem" }}>
        <CalcField label="Compressor (kW)" value={inputs.compressorKw} onChange={(v) => set("compressorKw", v)} />
        <CalcField label="No. of compressors" value={inputs.numberOfCompressors} onChange={(v) => set("numberOfCompressors", v)} />
        <CalcField label="Duty cycle %" value={inputs.dutyCyclePct} onChange={(v) => set("dutyCyclePct", v)} />
        <CalcField label="Setpoint (°C)" value={inputs.setpointC} onChange={(v) => set("setpointC", v)} />
        <CalcField label="Defrost (kWh/day)" value={inputs.defrostKwPerDay} onChange={(v) => set("defrostKwPerDay", v)} />
      </div>
      <div style={{ marginTop: "0.75rem", display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.85rem" }}>
        <span>Daily energy: <strong>{num(result.dailyKwh, 2)} kWh</strong></span>
        <span>Starting surge: <strong>{num(result.startingSurgeKva, 2)} kVA</strong></span>
        <span>Recommended support: <strong>{supportLabel}</strong></span>
      </div>
      <SimBadge level={result.backupRecommended ? "warning" : "info"}>{result.recommendation}</SimBadge>
      {result.autonomyWarning && <SimBadge level="danger">{result.autonomyWarning}</SimBadge>}
      <button className="btn btn-primary" style={{ marginTop: "0.5rem" }} onClick={() => onAddLoad(result.suggestedLoadItem)}>+ Add to load list</button>
    </div>
  );
}

function HvacCalculator({ onAddLoad }) {
  const [inputs, setInputs] = useState({ unitKw: 1.5, numberOfUnits: 2, inverterType: "non-inverter", hoursPerDay: 8, diversityFactorPct: 80 });
  const set = (k, v) => setInputs((s) => ({ ...s, [k]: v }));
  const result = useMemo(() => calcHvacLoad(inputs), [inputs]);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.6rem" }}>
        <CalcField label="Unit rating (kW)" value={inputs.unitKw} onChange={(v) => set("unitKw", v)} />
        <CalcField label="No. of units" value={inputs.numberOfUnits} onChange={(v) => set("numberOfUnits", v)} />
        <CalcField label="Type" value={inputs.inverterType} onChange={(v) => set("inverterType", v)} options={["non-inverter", "inverter"]} />
        <CalcField label="Hours/day" value={inputs.hoursPerDay} onChange={(v) => set("hoursPerDay", v)} />
        <CalcField label="Diversity %" value={inputs.diversityFactorPct} onChange={(v) => set("diversityFactorPct", v)} />
      </div>
      <div style={{ marginTop: "0.75rem", display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.85rem" }}>
        <span>Daily energy: <strong>{num(result.dailyKwh, 2)} kWh</strong></span>
        <span>Peak: <strong>{num(result.peakKw, 2)} kW</strong></span>
      </div>
      {result.backupWarning && <SimBadge level="warning">{result.backupWarning}</SimBadge>}
      <button className="btn btn-primary" style={{ marginTop: "0.5rem" }} onClick={() => onAddLoad(result.suggestedLoadItem)}>+ Add to load list</button>
    </div>
  );
}

function GeneratorHybridCalculator() {
  const [inputs, setInputs] = useState({ gensetKva: 20, fuelLPerHour: 4.5, runtimeHoursPerDay: 6, fuelCostPerLitre: 180, minimumLoadingPct: 30, solarDisplacementKwhPerDay: 15, existingLoadProfileKwhPerDay: 0 });
  const set = (k, v) => setInputs((s) => ({ ...s, [k]: v }));
  const result = useMemo(() => calcGeneratorHybrid(inputs), [inputs]);
  return (
    <div>
      <div style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: "0.5rem" }}>
        Reads/analyses the existing genset assumptions (see the Genset Hybrid tab for the fields that actually drive sizing) — this panel does not create a second genset model.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.6rem" }}>
        <CalcField label="Genset (kVA)" value={inputs.gensetKva} onChange={(v) => set("gensetKva", v)} />
        <CalcField label="Fuel (L/hr)" value={inputs.fuelLPerHour} onChange={(v) => set("fuelLPerHour", v)} />
        <CalcField label="Runtime hrs/day" value={inputs.runtimeHoursPerDay} onChange={(v) => set("runtimeHoursPerDay", v)} />
        <CalcField label="Fuel cost/L" value={inputs.fuelCostPerLitre} onChange={(v) => set("fuelCostPerLitre", v)} />
        <CalcField label="Min loading %" value={inputs.minimumLoadingPct} onChange={(v) => set("minimumLoadingPct", v)} />
        <CalcField label="Solar displacement (kWh/day)" value={inputs.solarDisplacementKwhPerDay} onChange={(v) => set("solarDisplacementKwhPerDay", v)} />
        <CalcField label="Existing load profile (kWh/day, optional)" value={inputs.existingLoadProfileKwhPerDay} onChange={(v) => set("existingLoadProfileKwhPerDay", v)} />
      </div>
      <div style={{ marginTop: "0.75rem", display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.85rem" }}>
        <span>Current diesel cost: <strong>{money(result.currentDieselCostPerDay)}/day</strong> ({num(result.dailyFuelL, 1)} L)</span>
        <span>Fuel savings: <strong>{money(result.fuelSavingsPerDay)}/day</strong> ({money(result.annualFuelSavings)}/yr)</span>
      </div>
      {result.wetStackingWarning && <SimBadge level="warning">{result.wetStackingWarning}</SimBadge>}
      <SimBadge level="info">{result.batteryRole}</SimBadge>
      <SimBadge level="info">{result.recommendedRuntimeStrategy}</SimBadge>
    </div>
  );
}

function LoadProfileChart({ profile }) {
  if (!profile || !profile.hours) return null;
  const W = 720, H = 220, MARGIN = 30, BOTTOM = 24;
  const innerW = W - MARGIN * 2, innerH = H - MARGIN - BOTTOM;
  const maxKw = Math.max(1, ...profile.hours.map((h) => Math.max(h.loadKw, h.solarKw)));
  const barW = innerW / 24;
  const yFor = (kw) => MARGIN + innerH - (kw / maxKw) * innerH;
  const solarPath = profile.hours.map((h, i) => `${i === 0 ? "M" : "L"} ${MARGIN + (i + 0.5) * barW} ${yFor(h.solarKw)}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: "720px", display: "block" }}>
        <line x1={MARGIN} y1={MARGIN + innerH} x2={W - MARGIN} y2={MARGIN + innerH} stroke="#cbd5e1" strokeWidth="1" />
        {profile.hours.map((h, i) => (
          <g key={i}>
            <rect x={MARGIN + i * barW + 1} y={yFor(h.loadKw)} width={barW - 2} height={Math.max(0, MARGIN + innerH - yFor(h.loadKw))} fill="#bfdbfe" />
            <rect x={MARGIN + i * barW + 1} y={yFor(h.criticalLoadKw)} width={barW - 2} height={Math.max(0, MARGIN + innerH - yFor(h.criticalLoadKw))} fill="#3b82f6" />
            {i % 3 === 0 && <text x={MARGIN + (i + 0.5) * barW} y={H - 6} fontSize="8.5" textAnchor="middle" fill="#64748b">{h.hour}:00</text>}
          </g>
        ))}
        <path d={solarPath} fill="none" stroke="#f59e0b" strokeWidth="2" />
      </svg>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.78rem", color: "#475569", marginTop: "0.4rem" }}>
        <span><span style={{ display: "inline-block", width: "10px", height: "10px", background: "#bfdbfe", marginRight: "0.3rem" }} />Total load</span>
        <span><span style={{ display: "inline-block", width: "10px", height: "10px", background: "#3b82f6", marginRight: "0.3rem" }} />Critical/backup load</span>
        <span><span style={{ display: "inline-block", width: "14px", height: "2px", background: "#f59e0b", marginRight: "0.3rem", verticalAlign: "middle" }} />Solar generation (simplified)</span>
      </div>
      <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>{profile.disclaimer}</div>
    </div>
  );
}

function Generation({ project, setProject, sizing }) {
  const update = (k, v) => setProject((p) => ({ ...p, [k]: v }));
  const tempLoss = Math.max(0, (project.cellTemp - 25) * Math.abs(project.temperatureCoeffPmax));
  return (
    <div className="grid-cols-2">
      <Card title="PV generation sizing" subtitle="PV size uses computed PR and worst-month irradiance for off-grid design.">
        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Metric label="Computed PR" value={pct(sizing.pr)} hint={`Temperature loss ${pct(tempLoss)}`} />
          <Metric label="Required PV" value={`${num(sizing.requiredKwp, 2)} kWp`} />
          <Metric label="Actual PV" value={`${num(sizing.actualKwp, 2)} kWp`} />
          <Metric label="Panels" value={`${sizing.panels}`} hint={`${project.panelW}W each`} />
          <Metric label="P50 Annual Energy" value={`${num(sizing.annualEnergy, 0)} kWh/yr`} />
          <Metric label="P90 Annual Energy" value={`${num(sizing.annualEnergyP90, 0)} kWh/yr`} />
          <Metric label="Worst Month PSH" value={`${num(sizing.worstMonthPsh, 1)} hrs/day`} hint={sizing.worstMonthName} danger={(project.systemType === "Off-grid" || project.systemType === "Mini-grid") && !sizing.offgridWorstMonthOk} />
          <Metric label="Worst Month Coverage" value={pct(sizing.offgridWorstMonthCoverage)} hint="Monthly solar / monthly load" danger={(project.systemType === "Off-grid" || project.systemType === "Mini-grid") && !sizing.offgridWorstMonthOk} good={sizing.offgridWorstMonthOk} />
        </div>
      </Card>

      <Card title="PR calculator" subtitle="Loss factors multiply to produce a defensible Performance Ratio.">
        <div className="form-grid">
          <Field label="Cell Temp" type="number" value={project.cellTemp} onChange={(v) => update("cellTemp", clamp(v, 25, 75))} suffix="°C" />
          <Field disabled={!!project.equipmentSelection?.enabled} label="Pmax Temp Coeff" type="number" value={project.temperatureCoeffPmax} onChange={(v) => update("temperatureCoeffPmax", v)} suffix="/°C" />
          <Field label="Soiling Loss" type="number" value={project.soilingLoss} onChange={(v) => update("soilingLoss", clamp(v, 0, 0.25))} suffix="0-1" />
          <Field label="Shading Loss" type="number" value={project.shadingLoss} onChange={(v) => update("shadingLoss", clamp(v, 0, 0.4))} suffix="0-1" />
          <Field label="LID Loss" type="number" value={project.lidLoss} onChange={(v) => update("lidLoss", clamp(v, 0, 0.08))} suffix="0-1" />
          <Field label="Mismatch Loss" type="number" value={project.mismatchLoss} onChange={(v) => update("mismatchLoss", clamp(v, 0, 0.1))} suffix="0-1" />
          <Field label="DC Cable Loss" type="number" value={project.dcCableLoss} onChange={(v) => update("dcCableLoss", clamp(v, 0, 0.08))} suffix="0-1" />
          <Field label="AC Cable Loss" type="number" value={project.acCableLoss} onChange={(v) => update("acCableLoss", clamp(v, 0, 0.08))} suffix="0-1" />
          <Field label="Availability Loss" type="number" value={project.availabilityLoss} onChange={(v) => update("availabilityLoss", clamp(v, 0, 0.15))} suffix="0-1" />
          <Field label="Inverter Efficiency" type="number" value={project.inverterEfficiency} onChange={(v) => update("inverterEfficiency", clamp(v, 0.75, 0.99))} suffix="0-1" />
        </div>
      </Card>

      <Card title="Monthly irradiance and yield" subtitle="Worst-month sizing matters most for off-grid and mini-grid projects." className="grid-cols-2" style={{ gridColumn: "1 / -1" }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Month</th>
                <th>PSH</th>
                <th>Monthly Yield</th>
                <th>Daily Load Coverage</th>
                <th>Design Note</th>
              </tr>
            </thead>
            <tbody>
              {sizing.monthlyYieldRows.map((row) => (
                <tr key={row.month} style={row.isWorstMonth ? { backgroundColor: "#fef3c7" } : {}}>
                  <td className="font-bold">{row.month}</td>
                  <td>{num(row.psh, 1)} hrs/day</td>
                  <td>{num(row.energyKwh, 0)} kWh/month</td>
                  <td>{pct(row.coverage)}</td>
                  <td className="font-bold">{row.isWorstMonth ? "Worst month — size off-grid carefully" : "Normal design month"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="carbon-info">
          Worst-month generation for {project.siteProfile} is <b>{num(sizing.worstMonthEnergy, 0)} kWh/month</b> against an estimated monthly load of <b>{num(sizing.worstMonthLoad, 0)} kWh/month</b>. For off-grid projects, the tool flags the design if worst-month coverage falls below 90%.
        </div>
        {(project.systemType === "Off-grid" || project.systemType === "Mini-grid") && sizing.requiredKwpWorstMonth90 > 0 && (
          <div style={{ marginTop:"0.75rem", padding:"0.75rem 1rem", background: sizing.actualKwp >= sizing.requiredKwpWorstMonth90 ? "#f0fdf4" : "#fffbeb", border:`1px solid ${sizing.actualKwp >= sizing.requiredKwpWorstMonth90 ? "#86efac" : "#fcd34d"}`, borderRadius:"0.5rem", fontSize:"0.85rem" }}>
            <b>Worst-month 90% coverage target:</b> requires <b>{num(sizing.requiredKwpWorstMonth90, 2)} kWp</b> ({Math.ceil(sizing.requiredKwpWorstMonth90 * 1000 / project.panelW)} panels at {project.panelW}W).
            {sizing.additionalPanelsForWorstMonth > 0
              ? ` Current array is short by ${sizing.additionalPanelsForWorstMonth} panel(s). Consider increasing array or adding autonomy days.`
              : " Current array meets the 90% worst-month target. ✅"}
          </div>
        )}
      </Card>
    </div>
  );
}

function Battery({ project, setProject, sizing, batteryHardware, night, highlightId }) {
  if (project.equipmentSelection?.enabled) return <div>
    <Card title="Documented battery bank" subtitle="Published usable energy; project efficiency is applied once. Quantities are explicitly selected, not silently increased.">
      <div className="form-grid">
        <Metric label="Battery units" value={sizing.batteryModules} />
        <Metric label="Published usable energy" value={`${num(sizing.batteryKwh, 2)} kWh`} />
        <Metric label="After project efficiency" value={`${num(sizing.usableBatteryKwh, 2)} kWh`} />
        <Metric label="Bank continuous DC power cap" value={`${num(sizing.equipment?.limits?.powerKw || 0, 2)} kW`} />
        <Metric label="Estimated autonomy" value={`${num(sizing.autonomyHours, 1)} h`} />
      </div>
    </Card>
    <EquipmentMatchingPanel project={project} setProject={setProject} sizing={sizing} />
  </div>;
  const chemistry = batteryChemistries[project.batteryChemistry];
  const selection = normalizeBatterySelection(project.batterySelection);
  const batteryAssets = listAssets("batteries").filter((asset) => !asset.documented);
  const setSelectionMode = (selection_mode) => setProject((current) => ({
    ...current,
    batterySelection: {
      ...normalizeBatterySelection(current.batterySelection),
      selection_mode,
      asset_id: selection_mode === "AUTO" ? null : normalizeBatterySelection(current.batterySelection).asset_id || batteryAssets[0]?.id || null,
      selected_at: new Date().toISOString(),
    },
    ...(selection_mode === "AUTO" ? {
      batteryModuleKwh: defaultProject.batteryModuleKwh,
      batteryModuleCost: defaultProject.batteryModuleCost,
      dod: batteryChemistries[current.batteryChemistry]?.dod || defaultProject.dod,
    } : {}),
  }));
  const selectManualAsset = (assetId) => {
    const asset = getAsset(assetId);
    if (!asset) return;
    setProject((current) => ({
      ...current,
      batterySelection: {
        ...normalizeBatterySelection(current.batterySelection),
        selection_mode: "MANUAL",
        asset_id: asset.id,
        selected_at: new Date().toISOString(),
      },
      batteryModuleKwh: Number(asset.nominal_kwh) || current.batteryModuleKwh,
      batteryModuleCost: Number(asset.price) || current.batteryModuleCost,
      dod: Number(asset.usable_dod) || current.dod,
    }));
  };
  return (
    <div className="grid-cols-2">
      <Card title="Battery sizing" subtitle="Hybrid uses critical night outage energy. Off-grid and mini-grid use autonomy days.">
        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Metric label="Critical Day Load" value={`${num(sizing.criticalDayKwh, 2)} kWh`} />
          <Metric label="Critical Night Load" value={`${num(sizing.criticalNightKwh, 2)} kWh`} />
          <Metric label="Backup Energy Needed" value={`${num(sizing.backupEnergyNeed, 2)} kWh`} />
          <Metric label="Required Battery" value={`${num(sizing.requiredBatteryKwh, 2)} kWh`} />
          <Metric label="Actual Battery" value={`${num(sizing.batteryKwh, 2)} kWh`} hint={`${sizing.batteryModules} × ${project.batteryModuleKwh} kWh`} />
          <Metric label="Estimated Autonomy (24h avg)" value={`${num(sizing.autonomyHours, 1)} hrs`} />
        </div>
      </Card>

      <Card title="Battery hardware selection" subtitle="Manual mode locks the battery model only. Quantity, usable energy, power and autonomy remain calculation-driven.">
        <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem" }}>
          {["AUTO", "MANUAL"].map((mode) => (
            <button key={mode} className={`btn ${selection.selection_mode === mode ? "btn-primary" : "btn-secondary"}`} onClick={() => setSelectionMode(mode)}>{mode === "AUTO" ? "Auto select" : "Manual hardware"}</button>
          ))}
        </div>
        {selection.selection_mode === "MANUAL" && (
          <div className="field-group" style={{ marginBottom: "0.75rem" }}>
            <span className="field-label">Battery asset</span>
            <select className="select-input" value={selection.asset_id || ""} onChange={(event) => selectManualAsset(event.target.value)}>
              {batteryAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.brand} {asset.model}</option>)}
            </select>
          </div>
        )}
        <div className="grid-cols-4">
          <Metric label="Required usable" value={`${num(batteryHardware?.required_usable_kwh, 2)} kWh`} />
          <Metric label="Calculated quantity" value={`${batteryHardware?.selected_quantity || 0}`} hint="Reactive, not manually frozen" />
          <Metric label="Installed nominal" value={`${num(batteryHardware?.installed_nominal_kwh, 2)} kWh`} />
          <Metric label="Continuous power" value={`${num(batteryHardware?.available_continuous_power_kw, 2)} kW`} />
        </div>
        <div style={{ marginTop: "0.65rem" }}>
          <SimBadge level={batteryHardware?.compatibility?.status === "PASS" ? "success" : "danger"}>
            Compatibility: {batteryHardware?.compatibility?.status || "PENDING"}
          </SimBadge>
          {(batteryHardware?.compatibility?.issues || []).map((issue) => <SimBadge key={issue.code} level="danger">{issue.message} {issue.suggested_correction}</SimBadge>)}
        </div>
      </Card>

      {/* v11.5.2 — night-load autonomy (RISK-1 fix) */}
      {night && (
        <Card title="Night-load autonomy" subtitle="Honest backup picture for night-dominant loads (flood/security/street lighting)."
          style={{ gridColumn: "1 / -1" }}>
          <div data-highlight="night-autonomy-card" className={highlightClass(highlightId, "night-autonomy-card") || undefined}>
            <div className="grid-cols-4">
              <Metric label="Night Load Share" value={`${Math.round((night.nightLoadShare || 0) * 100)}%`} hint="of total daily energy" danger={night.isNightDominantLoad} />
              <Metric label="Critical Night Energy" value={`${num(night.criticalNightKwh, 1)} kWh`} hint="what backup must carry" />
              <Metric label="Usable Battery" value={`${num(night.usableBatteryKwh, 1)} kWh`} hint="after DoD × efficiency" />
              <Metric label="Night Coverage" value={`${Math.round((night.nightEnergyCoverage || 0) * 100)}%`} good={night.nightEnergyCoverage >= 1} danger={night.nightEnergyCoverage < 0.6 && night.criticalNightKwh > 0} hint="of critical night energy" />
            </div>
            <div className="grid-cols-2" style={{ marginTop: "0.5rem" }}>
              <Metric label="Estimated Night Autonomy" value={`${num(night.estimatedNightAutonomyHours, 1)} hrs`} hint="on sustained night load" />
              <Metric label="Load Profile" value={night.isNightDominantLoad ? "Night-dominant" : "Day/mixed"} danger={night.isNightDominantLoad} />
            </div>
            {night.nightAutonomyWarning && (
              <div style={{ marginTop: "0.6rem" }}>
                <SimBadge level={night.nightEnergyCoverage < 1 ? "warning" : "info"}>{night.nightAutonomyWarning}</SimBadge>
              </div>
            )}
          </div>
        </Card>
      )}
      <Card title="Battery engineering checks" subtitle="Procurement, warranty and commissioning assumptions.">
        <div className="carbon-info" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", border: "none", background: "none" }}>
          <p>
            <b>Chemistry:</b> {chemistry.label}
          </p>
          <p>
            <b>DoD:</b> {pct(project.dod)} · <b>Round-trip efficiency:</b> {pct(project.batteryEfficiency)} · <b>Cycle life:</b> {nf.format(chemistry.cycleLife)}
          </p>
          <p>
            <b>Battery voltage:</b> {project.batteryVoltage}V nominal · <b>Estimated bank capacity:</b> {num(sizing.batteryNominalAh, 0)}Ah.
          </p>
          <p>
            <b>Inverter battery current requirement:</b> about {num(sizing.batteryInputA, 0)}A. Confirm BMS continuous and peak charge/discharge limits before procurement.
          </p>
          <p>
            <b>Replacement planning:</b> Year {chemistry.replacementYear} should be included in lifecycle costing for finance-grade proposals.
          </p>
        </div>
      </Card>
      <Card title="BMS protection settings" subtitle="Indicative commissioning guide; final values must follow the battery manufacturer manual." style={{ gridColumn: "1 / -1" }}>
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          <Metric label="OVP" value={chemistry.bms.ovp} />
          <Metric label="UVP" value={chemistry.bms.uvp} />
          <Metric label="Charge OTP" value={chemistry.bms.chargeOtp} />
          <Metric label="Discharge OTP" value={chemistry.bms.dischargeOtp} />
          <Metric label="Max Charge A" value={`${num(sizing.bmsMaxChargeA, 0)} A`} />
          <Metric label="Max Discharge A" value={`${num(sizing.bmsMaxDischargeA, 0)} A`} />
        </div>
      </Card>
    </div>
  );
}

// v11.6 — explains the inverter selection + DC:AC ratio and offers fixes.
const INVERTER_BASIS_OPTIONS = [
  { value: "auto_engineering", label: "Auto (engineering)" },
  { value: "backup_peak_led", label: "Backup / peak-led" },
  { value: "pv_ratio_led", label: "PV-ratio-led" },
  { value: "manual_review", label: "Manual review" },
];
const DCAC_SEVERITY_TONE = { high: "danger", medium: "warning", low: "info", none: "success" };
function InverterCoherenceCard({ sizing, project, setProject, navigateToTab }) {
  const inv = sizing.inverterSizing, dc = sizing.dcAcAnalysis;
  if (!inv || !dc) return null;
  const update = (k, v) => setProject((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Technical basis */}
      <div style={{ padding: "0.7rem 0.9rem", background: "var(--bg-main, #f8fafc)", border: "1px solid var(--border-medium, #e2e8f0)", borderRadius: "0.5rem", fontSize: "0.8rem", lineHeight: 1.6 }}>
        <div style={{ fontWeight: 800, marginBottom: "0.3rem", color: "var(--text-main)" }}>Technical basis — inverter sizing</div>
        <div><b>Selected because:</b> {inv.selectedReason} → <b>{num(inv.selectedInverterKw, 1)} kW</b></div>
        <div><b>Load/surge-based:</b> {num(inv.loadBasedInvKw, 1)} kW &nbsp;·&nbsp; <b>PV-based:</b> {num(inv.pvBasedInvKw, 1)} kW &nbsp;·&nbsp; <b>Peak (diversified):</b> {num(inv.peakKw, 2)} kW</div>
        <div style={{ color: "var(--text-muted)" }}>Running {num(inv.runningKw, 1)} kW ×{inv.runningDiversity} = {num(inv.diversifiedRunningKw, 1)} kW · Surge {num(inv.surgeKw, 1)} kW ×{inv.surgeDiversity} = {num(inv.diversifiedSurgeKw, 1)} kW · headroom ×{project.inverterHeadroom}</div>
      </div>

      {/* Sizing basis + diversity controls */}
      <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-medium)" }}>
          Inverter sizing basis
          <select className="input" disabled={!!project.equipmentSelection?.enabled} value={project.inverterSizingBasis} onChange={(e) => update("inverterSizingBasis", e.target.value)}>
            {INVERTER_BASIS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        {project.inverterSizingBasis === "manual_review" ? (
          <Field disabled={!!project.equipmentSelection?.enabled} label="Manual inverter (kW)" type="number" value={project.manualInverterKw} onChange={(v) => update("manualInverterKw", Math.max(0, v))} suffix="kW" />
        ) : <div />}
        <SmartNumberField label="Running diversity factor" value={project.runningLoadDiversityFactor} onCommit={(v) => update("runningLoadDiversityFactor", v)} min={0.1} max={1} emptyValue={0.75} />
        <SmartNumberField label="Surge diversity factor" value={project.surgeDiversityFactor} onCommit={(v) => update("surgeDiversityFactor", v)} min={0.1} max={1} emptyValue={0.65} />
      </div>
      <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
        Diversity factors account for the fact that not all connected loads run at the same time. Final design must confirm actual simultaneity.
        {project.inverterSizingBasis === "manual_review" && " Manual selection requires an engineering note."}
        {(!inv.loadSupported || inv.catalogueExceeded) && " ⚠ Selected inverter does not satisfy the requested sizing basis. Qualified engineering design is required."}
      </div>

      {/* Low DC:AC correction card */}
      {dc.isLow && (
        <WarningPanel tone={DCAC_SEVERITY_TONE[dc.severity] || "warning"} title="PV array is small compared to inverter">
          <div style={{ fontSize: "0.82rem", lineHeight: 1.6 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1.25rem", marginBottom: "0.4rem", fontWeight: 600 }}>
              <span>Current PV: {num(sizing.actualKwp, 1)} kWp ({sizing.panels} panels)</span>
              <span>Inverter: {num(sizing.inverterKw, 1)} kW</span>
              <span>DC:AC: {num(dc.ratio, 2)}</span>
              <span>Target: {dc.targetMin}–{dc.targetMax} (ideal {dc.targetIdealLow}–{dc.targetIdealHigh})</span>
            </div>
            <div style={{ marginBottom: "0.4rem" }}>{dc.explanation}</div>
            <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Corrective options</div>
            <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
              {dc.correctiveActions.map((a, i) => (
                <li key={i} style={{ marginBottom: "0.2rem" }}>
                  <b>{a.action}.</b> {a.detail}
                  {navigateToTab && a.actionTab && (
                    <button className="vf-link-btn" style={{ marginLeft: "0.35rem" }} onClick={() => navigateToTab(a.actionTab, { source: "inverter" })}>Go →</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </WarningPanel>
      )}
    </div>
  );
}

function Inverter({ project, setProject, sizing, highlightId, navigateToTab }) {
  const update = (k, v) => setProject((p) => ({ ...p, [k]: v }));
  return (
    <div className="grid-cols-2">
      <Card title="Inverter sizing" subtitle="Load, surge, PV ratio, string voltage, cable drops and altitude are checked together.">
        <div style={{ gridTemplateColumns: "1fr 1fr" }} data-highlight="cold-voc-card"
          className={`form-grid ${highlightClass(highlightId, "cold-voc-card")}`}>
          <Metric label="Recommended Size" value={`${num(sizing.inverterKw, 1)} kW`} hint={sizing.inverterSizing?.selectedReason} />
          <Metric label="DC:AC Ratio" value={num(sizing.dcAcRatio, 2)} hint={sizing.dcAcAnalysis?.status} danger={sizing.dcAcAnalysis?.severity === "high"} />
          <Metric label="Cold String Voc" value={`${num(sizing.stringVocCold, 0)} V`} hint={`Limit ${project.inverterMaxDcV}V`} danger={!sizing.coldVocOk} good={sizing.coldVocOk} />
          <Metric label="Effective panels/string used" value={`${sizing.stringSizing?.effectivePanelsPerString ?? sizing.panelsPerString}`} hint={`Requested ${sizing.stringSizing?.requestedPanelsPerString ?? project.panelsPerString}`} danger={!sizing.coldVocOk} />
          <Metric label="Max panels/string by voltage" value={`${sizing.maxPanelsPerString}`} hint="Cold-Voc limit" />
          <Metric label="DC Voltage Drop" value={pct(sizing.dcDropPct)} hint={`${num(sizing.dcDropV, 2)}V`} danger={sizing.dcDropPct > 0.015} />
          <Metric label="AC Voltage Drop" value={pct(sizing.acDropPct)} hint={`${num(sizing.acDropV, 2)}V at ${num(sizing.acCurrent, 1)}A`} danger={sizing.acDropPct > 0.03} />
          <Metric label="Site Altitude" value={`${num(project.altitude, 0)} m`} hint={`Genset derate ${pct(sizing.gensetDeratePct)}`} danger={project.systemType === "Genset hybrid" && sizing.gensetDeratePct > 0.02} />
          <Metric label="Genset Available" value={`${num(sizing.gensetAvailableKva, 2)} kVA`} hint={`From ${project.gensetRatedKva} kVA nameplate`} />
        </div>
        {sizing.stringSizing?.note && (
          <WarningPanel tone="info" title="String sizing">{sizing.stringSizing.note}</WarningPanel>
        )}
        <InverterCoherenceCard sizing={sizing} project={project} setProject={setProject} navigateToTab={navigateToTab} />
      </Card>
      <Card title="String, cable and altitude inputs" subtitle="Cold Voc follows the IEC 62548 principle; cable drop follows copper conductor resistance. Genset derating is altitude-adjusted.">
        <div className="form-grid">
          <Field disabled={!!project.equipmentSelection?.enabled} label="Module Voc STC" type="number" value={project.moduleVoc} onChange={(v) => update("moduleVoc", v)} suffix="V" />
          <Field disabled={!!project.equipmentSelection?.enabled} label="Module Vmp" type="number" value={project.moduleVmp} onChange={(v) => update("moduleVmp", v)} suffix="V" />
          <Field disabled={!!project.equipmentSelection?.enabled} label="Module Imp" type="number" value={project.moduleImp} onChange={(v) => update("moduleImp", v)} suffix="A" />
          <Field disabled={!!project.equipmentSelection?.enabled} label="Voc Temp Coeff" type="number" value={project.tempCoeffVoc} onChange={(v) => update("tempCoeffVoc", v)} suffix="/°C" />
          <Field disabled={!!project.equipmentSelection?.enabled} label="Min Site Temp" type="number" value={project.minTemp} onChange={(v) => update("minTemp", v)} suffix="°C" />
          <Field disabled={!!project.equipmentSelection?.enabled} label="Inverter Max DC V" type="number" value={project.inverterMaxDcV} onChange={(v) => update("inverterMaxDcV", v)} suffix="V" presets={[500, 600, 1000, 1100, 1500]} />
          <Field disabled={!!project.equipmentSelection?.enabled} label="Panels per String (requested)" type="number" value={project.panelsPerString} onChange={(v) => update("panelsPerString", Math.max(1, Math.floor(v)))} />
          <Field label="DC Cable Length" type="number" value={project.dcCableLengthM} onChange={(v) => update("dcCableLengthM", Math.max(v, 0))} suffix="m" />
          <Field label="DC Cable Size" type="number" value={project.dcCableSizeMm2} onChange={(v) => update("dcCableSizeMm2", v)} min={1} suffix="mm²" presets={[2.5, 4, 6, 10, 16, 25, 35, 50]} />
          <Field label="AC Cable Length" type="number" value={project.acCableLengthM} onChange={(v) => update("acCableLengthM", Math.max(v, 0))} suffix="m" />
          <Field label="AC Cable Size" type="number" value={project.acCableSizeMm2} onChange={(v) => update("acCableSizeMm2", v)} min={1} suffix="mm²" presets={[2.5, 4, 6, 10, 16, 25, 35, 50]} />
          <Field label="AC Voltage" type="number" value={project.acVoltage} onChange={(v) => update("acVoltage", v)} min={1} suffix="V" presets={[230, 400, 415]} />
          <Field disabled={!!project.equipmentSelection?.enabled} label="Site Altitude" type="number" value={project.altitude} onChange={(v) => update("altitude", Math.max(v, 0))} suffix="m" />
          <Field label="Genset Rated Capacity" type="number" value={project.gensetRatedKva} onChange={(v) => update("gensetRatedKva", Math.max(v, 0))} suffix="kVA" />
        </div>
        <div className="carbon-info" style={{ marginTop: "1rem" }}>
          At {num(project.altitude, 0)}m altitude, a {project.gensetRatedKva} kVA genset should be treated as approximately <b>{num(sizing.gensetAvailableKva, 2)} kVA available</b> using a simple 3% per 1,000m above 1,000m derating rule.
        </div>
      </Card>
    </div>
  );
}

function Finance({ project, setProject, sizing }) {
  const update = (k, v) => setProject((p) => ({ ...p, [k]: v }));
  const carbonRevenueY1 = project.carbonInCashflow ? sizing.carbonValue : 0;
  const quote = sizing.quote || { category_totals: {}, discount: 0, subtotal_net: 0, tax: 0, total_gross: 0 };
  const tariffHeld = sizing.tariffModel?.enabled && !sizing.tariffModel.ready;
  return (
    <div className="grid-cols-2 finance-workspace">
      <ElectricityTariffPanel project={project} setProject={setProject} sizing={sizing} />
      <Card title="Financial summary" subtitle={project.electricityTariff?.enabled ? "Savings use the reviewed bill before solar minus retained grid costs after solar. Future years remain forecasts." : "Savings now use annual kWh × tariff × self-consumption, not monthly bill × coverage."}>
        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Metric label="Total System Cost" value={money(sizing.totalCost)} />
          <Metric label="P50 Annual Savings" value={tariffHeld ? "Review tariff" : money(sizing.annualSavings)} />
          <Metric label="P90 Annual Savings" value={tariffHeld ? "Review tariff" : money(sizing.annualSavingsP90)} />
          <Metric label="Carbon Revenue Y1" value={money(carbonRevenueY1)} hint={project.carbonInCashflow ? `${num(sizing.carbonOffset, 2)} tCO₂/year` : "Excluded unless explicitly enabled"} />
          <Metric label="P50 Payback" value={tariffHeld ? "Review tariff" : Number.isFinite(sizing.payback) ? `${num(sizing.payback, 2)} yrs` : "Not reached"} />
          <Metric label="P90 Payback" value={tariffHeld ? "Review tariff" : Number.isFinite(sizing.paybackP90) ? `${num(sizing.paybackP90, 2)} yrs` : "Not reached"} />
          <Metric label="Project IRR" value={Number.isFinite(sizing.irrLife) ? pct(sizing.irrLife) : "Not available"} />
          <Metric label="Equity IRR" value={project.debtShare > 0 ? Number.isFinite(sizing.equityIrr) ? pct(sizing.equityIrr) : "Not available" : "Equity-only case"} />
          <Metric label="LCOE P50/P90" value={`${num(sizing.lcoe, 2)} / ${num(sizing.lcoeP90, 2)}`} hint="KES/kWh - canonical feasibility basis" />
          <Metric label="Cashflow Break-even" value={sizing.breakEvenYear ? `Year ${sizing.breakEvenYear}` : "Beyond project life"} hint="Actual zero-crossing from cashflow table" good={!!sizing.breakEvenYear} />
          <Metric label="Monte Carlo Payback" value={`${num(sizing.paybackP10, 1)} / ${num(sizing.paybackP50MonteCarlo, 1)} / ${num(sizing.paybackP90MonteCarlo, 1)}`} hint="P10 / P50 / P90 years" />
        </div>
      </Card>
      <Card title="Bankability / DSCR model" subtitle="P90 net benefit is used for debt service cover.">
        <div className="form-grid">
          <Field label="Grid Tariff" type="number" value={project.gridTariff} onChange={(v) => update("gridTariff", Math.max(v, 0))} suffix="KES/kWh" disabled={project.electricityTariff?.enabled} help={project.electricityTariff?.enabled ? "Flat rate is inactive while the reviewed tariff is applied." : "Flat-rate planning estimate; use the reviewed bill calculator above for itemised charges."} />
          <Field label="Tariff Escalation" type="number" value={project.tariffEscalation} onChange={(v) => update("tariffEscalation", clamp(v, 0, 0.3))} suffix="0-1" />
          <Field label="Self Consumption" type="number" value={project.selfConsumptionRate} onChange={(v) => update("selfConsumptionRate", clamp(v, 0, 1))} suffix="0-1" />
          <Field label="P90 Factor" type="number" value={project.p90Factor} onChange={(v) => update("p90Factor", clamp(v, 0.75, 1))} suffix="0-1" />
          <Field label="Debt Share" type="number" value={project.debtShare} onChange={(v) => update("debtShare", clamp(v, 0, 1))} suffix="0-1" />
          <Field label="Loan Interest" type="number" value={project.loanInterest} onChange={(v) => update("loanInterest", clamp(v, 0, 0.6))} suffix="0-1" />
          <Field label="Loan Term" type="number" value={project.loanTerm} onChange={(v) => update("loanTerm", clamp(v, 1, 20))} suffix="yrs" />
          <Field label="O&M Rate" type="number" value={project.oAndMRate} onChange={(v) => update("oAndMRate", clamp(v, 0, 0.1))} suffix="0-1" />
          <Field label="Degradation" type="number" value={project.degradation} onChange={(v) => update("degradation", clamp(v, 0, 0.03))} suffix="0-1" />
          <Field label="Carbon Price Escalation" type="number" value={project.carbonEscalation} onChange={(v) => update("carbonEscalation", clamp(v, 0, 0.3))} suffix="0-1" />
          <Field label="Inflation Rate" type="number" value={project.inflationRate} onChange={(v) => update("inflationRate", clamp(v, 0, 0.3))} suffix="0-1" />
          {project.electricityTariff?.enabled ? <p className="tariff-help">Reviewed tariff mode always caps avoided imports to generation, captured loads and recorded bill kWh. The legacy flat-rate bill cap is inactive; export credits are not modelled.</p> : <CheckField label="Cap savings to current bill" checked={project.capSavingsToBill} onChange={(v) => update("capSavingsToBill", v)} help="Keep enabled for normal client proposals. Disable only for export/feed-in or special tariff models." />}
        </div>
        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: "1.5rem" }}>
          <Metric label="Debt Principal" value={money(sizing.debtPrincipal)} />
          <Metric label="Annual Debt Service" value={money(sizing.annualDebtService)} />
          <Metric label="P90 DSCR Year 1" value={project.debtShare > 0 ? num(sizing.dscrYear1, 2) : "N/A"} hint={project.debtShare > 0 ? "Debt enabled" : "Set debt share to model financing"} danger={sizing.dscrYear1 < 1.2 && project.debtShare > 0.3} />
          <Metric label="Equity NPV" value={money(sizing.equityNpvLife)} />
        </div>
      </Card>
      <Card title="Proposal Price Breakdown" subtitle={`Single quote engine · ${quote.tax_rule_version || project.taxRuleVersion || "unversioned tax policy"}`} style={{ gridColumn: "1 / -1" }}>
        <div className="cost-summary-grid">
          {[
            ["Equipment", quote.category_totals?.EQUIPMENT || 0],
            ["Labour", quote.category_totals?.LABOUR || 0],
            ["Transport", quote.category_totals?.TRANSPORT || 0],
            ["Other", quote.category_totals?.OTHER || 0],
            ["Discount", -(quote.discount || 0)],
            ["Subtotal ex VAT", quote.subtotal_net || 0],
            ["VAT", quote.tax || 0],
            ["Total inc VAT", quote.total_gross || 0],
          ].map(([label, value]) => <div key={label} className="cost-summary-item"><span>{label}</span><strong>{money(value)}</strong></div>)}
        </div>
      </Card>
      <Card title="Cost build-up" subtitle="Indicative pricing; final quote needs supplier confirmation." style={{ gridColumn: "1 / -1" }}>
        <div className="cost-summary-grid">
          {[
            ["PV panels", sizing.pvCost],
            ["Mounting hardware", sizing.mountingCost],
            ["Hybrid/Grid-tied Inverter", sizing.inverterCost],
            ["Battery Storage bank", sizing.batteryCost],
            ["Cabling & electrical protection", project.cablingProtectionCost],
            ["IoT Remote Monitoring", project.monitoringCost],
            ["EPC / Installation services", project.epcCost],
            ...(sizing.specialistCapex > 0 ? [["Specialist system capex", sizing.specialistCapex]] : []),
            ["Sizing Contingency", sizing.contingencyAmount],
            ["Value Added Tax (VAT 16%)", sizing.vatAmount],
          ].map(([k, v]) => (
            <div key={k} className="cost-summary-item">
              <span>{k}</span>
              <strong>{money(v)}</strong>
            </div>
          ))}
        </div>
      </Card>
      <Card title="25-year energy and cashflow table" subtitle="Shows annual degradation, tariff escalation, carbon value, debt service and cumulative project cashflow." style={{ gridColumn: "1 / -1" }}>
        <div className="table-container" style={{ maxHeight: "500px", overflowY: "auto" }}>
          <table className="table">
            <thead style={{ position: "sticky", top: 0, zIndex: 5 }}>
              <tr>
                <th>Year</th>
                <th>P50 kWh</th>
                <th>P90 kWh</th>
                <th>Savings</th>
                <th>Carbon</th>
                <th>O&M (esc.)</th>
                <th>Batt. Repl.</th>
                <th>Project Net</th>
                <th>Debt</th>
                <th>DSCR</th>
                <th>Equity Net</th>
                <th>Cumulative</th>
                <th>Disc. Cumul.</th>
              </tr>
            </thead>
            <tbody>
              {sizing.annualRows.map((r) => (
                <tr key={r.year} style={r.batteryReplCost > 0 ? { backgroundColor: "#fef3c7" } : {}}>
                  <td className="font-bold">{r.year}</td>
                  <td>{num(r.energyY, 0)}</td>
                  <td>{num(r.energyP90Y, 0)}</td>
                  <td>{money(r.savingsY)}</td>
                  <td>{money(r.carbonY)}</td>
                  <td>{money(r.annualOmY)}</td>
                  <td style={{ color: r.batteryReplCost > 0 ? "#92400e" : "inherit", fontWeight: r.batteryReplCost > 0 ? 700 : 400 }}>{r.batteryReplCost > 0 ? money(r.batteryReplCost) : "—"}</td>
                  <td className="font-bold">{money(r.netY)}</td>
                  <td>{money(r.debtY)}</td>
                  <td style={{ color: r.dscrY !== null && r.dscrY < 1.2 ? "#dc2626" : "inherit" }}>{r.dscrY !== null ? num(r.dscrY, 2) : "—"}</td>
                  <td>{money(r.equityNetY)}</td>
                  <td className="font-bold" style={{ color: r.cumulativeProjectCash >= 0 ? "var(--color-emerald)" : "inherit" }}>{money(r.cumulativeProjectCash)}</td>
                  <td className="font-bold" style={{ color: "var(--text-muted)" }}>
                    {money(r.cumulativeDiscounted)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

const ACCESSORY_CATEGORY_LABELS = {
  mounting: "Mounting", dc: "DC electrical", ac: "AC electrical", battery: "Battery accessories",
  earthing: "Earthing / lightning", monitoring: "Monitoring", consumables: "Consumables / labour", commercial: "Labour, transport & markup", manual: "Manually added",
};

function BOQ({ project, sizing, accessoriesBoQ, borehole, setActive }) {
  if (sizing.quoteReady === false || sizing.loadInventoryBlocked || sizing.loadInventoryPending || sizing.loadInventoryInvalid) {
    return (
      <Card title="Dynamic Bill of Quantities" subtitle="Pricing is held until load and equipment checks are complete.">
        <WarningPanel tone="warning" title={sizing.quoteBlockedReason || LOAD_PENDING_LABEL}>
          Resolve the stated issue in Load Assessment or Asset library before generating procurement values.
        </WarningPanel>
      </Card>
    );
  }
  const inventoryWarnings = normalizeAssetSelections(project.assetSelections)
    .map((selection) => ({ selection, availability: getCommercialAvailability(getAsset(selection.assetId) || {}, (project.inventoryLinks || {})[selection.assetId]) }))
    .filter(({ availability }) => availability.state !== "AVAILABLE");
  const labourAllowance = Math.round((Number(project.epcCost) || 0) * 0.65);
  const transportAllowance = Math.round((Number(project.epcCost) || 0) * 0.2);
  const markupAllowance = Math.max(0, (Number(project.epcCost) || 0) - labourAllowance - transportAllowance);
  const rows = [
    ["1.1", sizing.equipment?.models?.panel || "PV Panels", sizing.panels, "panels", project.panelCost, sizing.pvCost],
    ["1.2", "Mounting rails, clamps & hardware", sizing.panels, "sets", project.mountingPerPanel, sizing.mountingCost],
    ["2.1", sizing.equipment?.models?.inverter || "Hybrid/Grid-tied inverter", 1, "unit", sizing.inverterCost, sizing.inverterCost],
    ["3.1", sizing.equipment?.models?.battery || `${batteryChemistries[project.batteryChemistry].label} battery modules`, sizing.batteryModules, "units", project.batteryModuleCost, sizing.batteryModules * project.batteryModuleCost],
    ["3.2", "Battery rack, BMS accessories & interconnects", 1, "lot", 16000, 16000],
    ["4.1", "DC/AC cabling, breakers, SPDs, earthing", 1, "lot", project.cablingProtectionCost, project.cablingProtectionCost],
    ["5.1", "IoT monitoring system", 1, "lot", project.monitoringCost, project.monitoringCost],
    ["10.1", "Installation labour allowance", 1, "allowance", labourAllowance, labourAllowance],
    ["10.2", "Transport / logistics allowance", 1, "allowance", transportAllowance, transportAllowance],
    ["10.3", "Project overhead / markup allowance", 1, "allowance", markupAllowance, markupAllowance],
    ["", "Contingency", 1, "allowance", sizing.contingencyAmount, sizing.contingencyAmount],
    ["", "VAT", 1, "tax", sizing.vatAmount, sizing.vatAmount],
  ];

  // Specialist capex is already included in sizing.contingencyAmount and sizing.vatAmount base.
  // Show specialist items as informational breakdown lines (value 0 so they don't double-count grand total).
  if (project.systemType === "Genset hybrid") {
    rows.splice(rows.length - 2, 0, ["6.1", "Genset ATS integration, fuel interface & commissioning (incl. in system cost)", 1, "lot", 85000, 0]);
  }
  if (project.systemType === "EV charging") {
    const evUnitCost = evChargerSpecs[project.evChargerType]?.unitCost ?? 0;
    const evCableCost = project.evChargersTotal * 25000;
    const ocppCost = sizing.ocppRequired ? 48000 : 0;
    rows.splice(
      rows.length - 2,
      0,
      ["6.1", "EV charger units (incl. in system cost)", project.evChargersTotal, "units", evUnitCost, 0],
      ["6.2", "EV supply cabling & bay installation (incl. in system cost)", project.evChargersTotal, "bays", 25000, 0]
    );
    if (sizing.ocppRequired) rows.splice(rows.length - 2, 0, ["6.3", "OCPP smart charging software (incl. in system cost)", 1, "lot", ocppCost, 0]);
  }
  if (project.systemType === "Mini-grid") {
    rows.splice(
      rows.length - 2,
      0,
      ["7.1", "LV distribution line, poles & service drops", 1, "lot", project.mgCapexDistribution, project.mgCapexDistribution],
      ["7.2", "Smart commercial meters (incl. in system cost)", sizing.totalSubscribers, "units", 6500, 0],
      ["7.3", "SCADA / billing integration (incl. in system cost)", 1, "lot", 85000, 0]
    );
  }
  if (project.carbonStandard !== "Internal") {
    rows.splice(
      rows.length - 2,
      0,
      ["8.1", "Carbon monitoring equipment & data logger (advisory — not in base capex)", 1, "lot", 85000, 0],
      ["8.2", `Carbon project registration — ${project.carbonStandard} (advisory)`, 1, "lot", 350000, 0],
      ["8.3", "Annual MRV reporting service — Year 1 (advisory)", 1, "lot", project.carbonMrvCostKes, 0]
    );
  }

  // v11.6 — Solar borehole is a dedicated subsystem: its BoQ is additive to the
  // generation-system cost (real totals, so it flows into the grand total).
  if (project.borehole?.enabled && borehole) {
    const bq = buildBoreholeBoQ(project.borehole, borehole);
    bq.rows.forEach((r, i) => rows.push([`9.${i + 1}`, `Borehole: ${r.item}`, r.qty, r.unit, r.unitCost, r.total]));
  }

  // Distribution capex for mini-grid is an add-on outside the generation system cost
  const boqGrandTotal = sizing.quote?.total_gross ?? sizing.totalCost;
  const detailedBosSubtotal = accessoriesBoQ?.totalCost || 0;
  const headlineReconciliation = Math.max(0, (Number(sizing.totalCost) || boqGrandTotal) - detailedBosSubtotal);

  return (
    <Card title="Dynamic Bill of Quantities" subtitle="Auto-generated from sizing outputs. Lines marked '(incl. in system cost)' show breakdown only — value is captured in Contingency and VAT base.">
      {inventoryWarnings.length > 0 && (
        <WarningPanel tone="warning" title="Equipment availability requires confirmation">
          {inventoryWarnings.length} selected technical asset(s) are catalog-only, stale, low-stock, out-of-stock or unlinked. The engineering design remains valid, but do not treat this BoQ as procurement-ready until availability and selling prices are confirmed.
        </WarningPanel>
      )}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Unit Cost</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isInfoLine = Number(r[5]) === 0 && Number(r[4]) > 0;
              return (
                <tr key={i} style={isInfoLine ? { opacity: 0.55, fontStyle: "italic" } : {}}>
                  <td style={{ color: "var(--text-muted)" }}>{r[0]}</td>
                  <td className="font-bold">{r[1]}</td>
                  <td>{num(r[2], 0)}</td>
                  <td>{r[3]}</td>
                  <td>{money(r[4])}</td>
                  <td className="font-bold text-right">{isInfoLine ? "—" : money(r[5])}</td>
                </tr>
              );
            })}
            <tr style={{ backgroundColor: "var(--bg-dark)", color: "var(--text-white)" }}>
              <td colSpan="5" className="font-bold" style={{ padding: "1.1rem" }}>
                Grand Total incl. VAT
              </td>
              <td className="font-black text-right" style={{ fontSize: "1.1rem" }}>
                {money(boqGrandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {accessoriesBoQ && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "0.75rem", marginTop: "0.75rem" }}>
          <Metric label="Headline BoQ total" value={money(boqGrandTotal)} hint="Client-facing quote total" />
          <Metric label="Detailed BOS reference" value={money(detailedBosSubtotal)} hint="Procurement line detail" />
          <Metric label="Balance: equipment, labour, tax & markup" value={money(headlineReconciliation)} hint="Explains why BOS is not added again" />
        </div>
      )}

      {accessoriesBoQ && (
        <div style={{ marginTop: "1.5rem", borderTop: "2px solid #e2e8f0", paddingTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>Accessories / BOS — detailed breakdown</div>
            {setActive && <button onClick={() => setActive("accessories")} className="btn btn-secondary" style={{ fontSize: "0.78rem", padding: "0.3rem 0.8rem" }}>Edit in Accessories / BOS tab →</button>}
          </div>
          <div style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: "0.75rem" }}>
            Real bill-of-materials detail for procurement, generated from the actual roof layout and string design.
            This is a reference breakdown only — it is <strong>not added again</strong> to the Grand Total above, which already
            includes Mounting / DC-AC cabling &amp; protection / Monitoring as lump-sum allowances.
          </div>
          {Object.entries(accessoriesBoQ.categories).filter(([, rows]) => rows.length > 0).map(([catKey, rows]) => (
            <div key={catKey} style={{ marginBottom: "0.6rem" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: "0.2rem" }}>{ACCESSORY_CATEGORY_LABELS[catKey] || catKey}</div>
              <div className="table-container">
                <table className="table">
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.itemCode}>
                        <td style={{ fontSize: "0.8rem" }}>{r.name}</td>
                        <td style={{ fontSize: "0.8rem", color: "#64748b" }}>{num(r.qty, r.qty % 1 === 0 ? 0 : 1)} {r.unit}</td>
                        <td style={{ fontSize: "0.8rem", color: "#64748b" }}>{money(r.unitCost)}</td>
                        <td style={{ fontSize: "0.8rem", fontWeight: 700, textAlign: "right" }}>{money(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.4rem", padding: "0.6rem 0.85rem", display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>BOS subtotal (reference only)</span>
            <span>{money(accessoriesBoQ.totalCost)}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ─── ACCESSORIES / BOS TAB ──────────────────────────────────────────── */

function AccessoriesTab({ accessoriesBoQ, accessoryOverrides, setAccessoryOverrides, accessoriesAssumptions, setAccessoriesAssumptions }) {
  const [manualDraft, setManualDraft] = useState({ name: "", unit: "piece", qty: 1, unitCost: 0 });

  const setItemOverride = (itemCode, patch) => {
    setAccessoryOverrides((o) => ({ ...o, items: { ...o.items, [itemCode]: { ...(o.items[itemCode] || {}), ...patch } } }));
  };
  const resetItem = (itemCode) => {
    setAccessoryOverrides((o) => { const items = { ...o.items }; delete items[itemCode]; return { ...o, items }; });
  };
  const addManualItem = () => {
    if (!manualDraft.name) return;
    setAccessoryOverrides((o) => ({ ...o, manualItems: [...o.manualItems, { id: Date.now(), ...manualDraft }] }));
    setManualDraft({ name: "", unit: "piece", qty: 1, unitCost: 0 });
  };
  const removeManualItem = (id) => setAccessoryOverrides((o) => ({ ...o, manualItems: o.manualItems.filter((m) => m.id !== id) }));
  const updateManualItem = (id, patch) => setAccessoryOverrides((o) => ({ ...o, manualItems: o.manualItems.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  const updateAssumption = (key, value) => setAccessoriesAssumptions((a) => ({ ...a, [key]: Number(value) || 0 }));

  const categoryEntries = Object.entries(accessoriesBoQ.categories).filter(([, rows]) => rows.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Card title="Accessories / BOS summary" subtitle="Recalculated live from panel count, roof layout, string plan, cable routes and system type.">
        <div className="grid-cols-4">
          {categoryEntries.map(([key, rows]) => (
            <Metric key={key} label={ACCESSORY_CATEGORY_LABELS[key] || key} value={money(rows.reduce((s, r) => s + r.total, 0))} hint={`${rows.length} item(s)`} />
          ))}
        </div>
        <div style={{ marginTop: "0.75rem", padding: "0.75rem 1rem", background: "#0f172a", color: "#fff", borderRadius: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700 }}>Total BOS cost</span>
          <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>{money(accessoriesBoQ.totalCost)}</span>
        </div>
        {accessoriesBoQ.missingAssumptions.length > 0 && (
          <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {accessoriesBoQ.missingAssumptions.map((m, i) => <SimBadge key={i} level="info">{m}</SimBadge>)}
          </div>
        )}
        {(accessoriesBoQ.advisories || []).length > 0 && (
          <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {accessoriesBoQ.advisories.map((m, i) => <SimBadge key={i} level="warning">{m}</SimBadge>)}
          </div>
        )}
        <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          This total is a real-BOM reference for procurement. It is shown separately from — not added into — the engineering BoQ's
          Mounting / DC-AC cabling &amp; protection / Monitoring lump sums, to avoid double-counting the same materials twice.
        </div>
      </Card>

      {categoryEntries.map(([catKey, rows]) => (
        <Card key={catKey} title={ACCESSORY_CATEGORY_LABELS[catKey] || catKey} subtitle="Override quantity/price, exclude, or reset to the auto-calculated value.">
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Item</th><th>Qty</th><th>Unit cost</th><th className="text-right">Total</th><th>Source</th><th>Depends on</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const isManualRow = catKey === "manual";
                  const isOverridden = r.source === "manual" && !isManualRow;
                  const manualId = isManualRow ? Number(r.itemCode.replace("MANUAL-", "")) : null;
                  return (
                    <tr key={r.itemCode}>
                      <td className="font-bold">{r.name}</td>
                      <td>
                        <input type="number" min="0" className="table-input" style={{ width: "70px" }} value={r.qty}
                          onChange={(e) => isManualRow ? updateManualItem(manualId, { qty: Number(e.target.value) || 0 }) : setItemOverride(r.itemCode, { qtyOverride: Number(e.target.value) || 0 })} />
                        <span style={{ fontSize: "0.7rem", color: "#94a3b8", marginLeft: "0.3rem" }}>{r.unit}</span>
                      </td>
                      <td>
                        <input type="number" min="0" className="table-input" style={{ width: "90px" }} value={r.unitCost}
                          onChange={(e) => isManualRow ? updateManualItem(manualId, { unitCost: Number(e.target.value) || 0 }) : setItemOverride(r.itemCode, { unitCostOverride: Number(e.target.value) || 0 })} />
                      </td>
                      <td className="font-bold text-right">{money(r.total)}</td>
                      <td><span style={{ fontSize: "0.7rem", padding: "0.1rem 0.5rem", borderRadius: "1rem", background: isOverridden ? "#fef3c7" : "#dcfce7", color: isOverridden ? "#78350f" : "#166534" }}>{r.source}</span></td>
                      <td style={{ fontSize: "0.75rem", color: "#64748b" }}>{r.dependency}</td>
                      <td>
                        {isManualRow ? (
                          <button onClick={() => removeManualItem(manualId)} className="btn btn-danger" style={{ padding: "0.2rem 0.5rem" }}>✕</button>
                        ) : (
                          <button onClick={() => resetItem(r.itemCode)} className="btn btn-secondary" style={{ padding: "0.2rem 0.5rem", fontSize: "0.72rem" }}>↺ Auto</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      <Card title="Add manual item" subtitle="For anything not covered by the auto-calculated catalogue.">
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: "0.5rem", alignItems: "end" }}>
          <Field label="Name" value={manualDraft.name} onChange={(v) => setManualDraft((d) => ({ ...d, name: v }))} />
          <Field label="Unit" value={manualDraft.unit} onChange={(v) => setManualDraft((d) => ({ ...d, unit: v }))} />
          <Field label="Qty" type="number" value={manualDraft.qty} onChange={(v) => setManualDraft((d) => ({ ...d, qty: Number(v) || 0 }))} />
          <Field label="Unit cost" type="number" value={manualDraft.unitCost} onChange={(v) => setManualDraft((d) => ({ ...d, unitCost: Number(v) || 0 }))} />
          <button onClick={addManualItem} className="btn btn-primary">+ Add</button>
        </div>
      </Card>

      <Card title="Formula assumptions" subtitle="Editable constants used by the accessory calculations above (rail/L-foot spacing, allowances, isolator capacity, etc.).">
        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          {Object.entries(accessoriesAssumptions).map(([key, value]) => (
            <Field key={key} label={key} type="number" value={value} onChange={(v) => updateAssumption(key, v)} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function CloudReviewWorkflow({ platform, organisationId, projectId, actorRole, onPrepareVersion, showToast }) {
  const [submissions, setSubmissions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const current = submissions[0] || null;
  const canReview = actorRole === "manager" || actorRole === "engineer";
  const refresh = async () => {
    const rows = await platform.reviews.listSubmissions({ organisationId, projectId });
    setSubmissions(rows || []);
  };
  useEffect(() => {
    let active = true;
    platform.reviews.listSubmissions({ organisationId, projectId })
      .then((rows) => { if (active) setSubmissions(rows || []); })
      .catch((error) => { if (active) showToast(`Could not load review status: ${error?.message || "unknown error"}`, "error"); });
    return () => { active = false; };
  }, [platform, organisationId, projectId]);
  const prepare = async () => {
    setBusy(true);
    try {
      const version = await onPrepareVersion("issued", "review_submission");
      await platform.reviews.createSubmission({
        organisationId,
        projectId,
        projectVersionId: version.id,
        reason: "Proposal version prepared for controlled review",
        requestId: crypto.randomUUID(),
      });
      await refresh();
      showToast("Issued version created and review draft recorded in the organisation workspace.");
    } catch (error) {
      showToast(`Could not prepare review: ${error?.message || "unknown error"}`, "error");
    } finally {
      setBusy(false);
    }
  };
  const transition = async (to) => {
    if (!current) return;
    setBusy(true);
    try {
      await platform.reviews.transitionSubmission({
        organisationId,
        submissionId: current.id,
        to,
        reason: reason.trim() || null,
        requestId: crypto.randomUUID(),
      });
      setReason("");
      await refresh();
      showToast(`Review moved to ${to.replace(/_/g, " ")}.`);
    } catch (error) {
      showToast(`Review update failed: ${error?.message || "unknown error"}`, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="Controlled review" subtitle="Immutable version and server audit workflow.">
      {!current ? (
        <button className="btn btn-primary btn-full" disabled={busy} onClick={prepare}>Prepare issued review version</button>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Version {current.projectVersionId?.slice(0, 8)}</span>
            <StatusPill tone={current.status === "approved" ? "success" : current.status === "rejected" ? "danger" : "info"}>{current.status.replace(/_/g, " ")}</StatusPill>
          </div>
          {current.status === "draft" && <button className="btn btn-primary btn-full" disabled={busy} onClick={() => transition("review_ready")}>Mark review ready</button>}
          {current.status === "review_ready" && <button className="btn btn-primary btn-full" disabled={busy} onClick={() => transition("submitted")}>Submit for review</button>}
          {current.status === "submitted" && canReview && <button className="btn btn-primary btn-full" disabled={busy} onClick={() => transition("in_review")}>Start review</button>}
          {current.status === "in_review" && canReview && (
            <div style={{ display: "grid", gap: "0.6rem" }}>
              <input className="field-input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Decision reason" />
              <div style={{ display: "flex", gap: "0.6rem" }}>
                <button className="btn btn-primary" disabled={busy || reason.trim().length < 3} onClick={() => transition("approved")}>Approve</button>
                <button className="btn btn-secondary" disabled={busy || reason.trim().length < 3} onClick={() => transition("rejected")}>Reject</button>
              </div>
            </div>
          )}
          {current.status === "rejected" && <button className="btn btn-secondary btn-full" disabled={busy} onClick={() => transition("draft")}>Return to draft</button>}
        </>
      )}
    </Card>
  );
}

function CloudVersionHistory({ platform, organisationId, projectId, showToast }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    platform.projects.listVersions({ organisationId, projectId })
      .then((rows) => { if (active) setVersions(Array.isArray(rows) ? rows : []); })
      .catch((error) => { if (active) showToast?.(`Could not load version history: ${error?.message || "unknown error"}`, "error"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [platform, organisationId, projectId, reloadKey]);
  return (
    <Card title="Proposal version history" subtitle="Immutable records of every proposal version — saved in Zoho and tamper-proof.">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
        <button className="btn btn-secondary" style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }} onClick={() => setReloadKey((k) => k + 1)}>↻ Refresh</button>
      </div>
      {loading ? (
        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Loading version history…</div>
      ) : versions.length === 0 ? (
        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>No versions yet. Preparing a proposal records an immutable version here.</div>
      ) : (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {versions.map((v) => (
            <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0.65rem", border: "1px solid var(--border)", borderRadius: "0.5rem" }}>
              <div style={{ display: "grid", gap: "0.15rem", minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>Version {v.versionNo} · {String(v.lifecycle || "").replace(/_/g, " ")}</span>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  {v.issuedAt ? `Issued ${formatAuditTime(v.issuedAt)}` : (v.createdAt ? `Prepared ${formatAuditTime(v.createdAt)}` : "")}
                </span>
                {v.snapshotHash && <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(v.snapshotHash)}</span>}
              </div>
              <StatusPill tone={v.lifecycle === "issued" ? "success" : "info"}>{v.immutable ? "🔒 locked" : String(v.lifecycle || "")}</StatusPill>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Proposal({ project, setProject, sizing, loadItemsV2, showToast, survey, readiness, projectReadiness, navigateToTab, advisory, panelLayout, tiltGuidance, roofGeometry, simulation, simWarnings, stringPlan, loadSummary, loadWarnings, dataLoggerRecommendation, accessoriesBoQ, borehole, viewMode, billLoadReconciliation, onPrepareVersion, cloudEnabled = false, platform, activeMembership, actorRole, cloudProjectId }) {
  const clientExp = advisory?.clientFriendlySummary;
  const proposalViewMode = normalizeViewMode(viewMode);
  const isEngineerView = proposalViewMode === "engineer";
  const isTechnicianView = proposalViewMode === "technician";
  const isClientLikeView = proposalViewMode === "client" || proposalViewMode === "bank";
  const canShowInternalProposal = isEngineerView;
  const canShowCommercialProposal = !isTechnicianView;
  const loadQuoteBlocked = sizing.quoteReady === false || !!sizing.loadInventoryBlocked || !!sizing.loadInventoryPending || !!sizing.loadInventoryInvalid;
  const proposalBlockedLabel = sizing.quoteBlockedReason || LOAD_PENDING_LABEL;
  const proposalBlockedHint = sizing.equipment?.enabled && !sizing.equipment.quoteReady ? "Resolve equipment matching in Asset library before exporting a commercial proposal." : sizing.tariffModel?.enabled && !sizing.tariffModel.ready ? "Review and apply the bill and tariff inputs in Financials + DSCR before exporting." : "Add committed loads and click Update Sizing before pricing.";
  const visibleReportModes = isEngineerView ? REPORT_MODES : isTechnicianView ? ["technician"] : ["client"];
  const billLoadMessage = billLoadClientMessage(billLoadReconciliation);
  const quote = sizing.quote || { category_totals: {}, discount: 0, subtotal_net: 0, tax: 0, total_gross: 0 };
  const selectedDesignStale = !!project.selectedDesignOption
    && project.selectedDesignOption.inputs_hash !== project.designRevision?.inputs_hash;
  const inventoryWarnings = normalizeAssetSelections(project.assetSelections)
    .map((selection) => getCommercialAvailability(getAsset(selection.assetId) || {}, (project.inventoryLinks || {})[selection.assetId]))
    .filter((availability) => availability.state !== "AVAILABLE");
  const commercialClaimsBlocked = isClientLikeView && billLoadReconciliation?.clientClaimsBlocked;
  // v11.6 — borehole proposal section (only when the module is enabled)
  const boreholeEnabled = !!project.borehole?.enabled;
  const boreholeProp = boreholeEnabled && borehole ? summarizeBoreholeForProposal(project.borehole, borehole) : null;
  // v11.5.2 — central-engine readiness snapshot for the proposal + gate.
  const pr = projectReadiness || null;
  const prBlockers = pr?.criticalIssues || [];
  const prRequiredMissing = (pr?.missingFields || []).filter((m) => m.priority === "required" || m.priority === "critical");
  const prNightCaution = pr?.night?.nightAutonomyWarning && pr.night.nightEnergyCoverage < 1 ? pr.night.nightAutonomyWarning : null;
  const prWarnings = (pr?.warnings || []).filter((w) => w.priority === "warning").map((w) => w.label);
  const readinessLine = pr
    ? `PROJECT READINESS: ${pr.overallScore}/100 · ${prBlockers.length > 0 ? "Engineering review required" : pr.readyForProposal ? "Ready to propose" : "In progress"}${prBlockers.length ? ` · ${prBlockers.length} critical blocker(s)` : ""}${prRequiredMissing.length ? ` · ${prRequiredMissing.length} required item(s) outstanding` : ""}.`
    : "";
  const proposalText = loadQuoteBlocked
    ? `SOLARISE PRO - PROPOSAL STATUS

Client: ${project.client}
Location: ${project.location}
System Type: ${project.systemType}
Monthly bill reference: ${money(project.monthlyBill)}

Status: ${proposalBlockedLabel}
Next step: Complete a committed load inventory and click Update Sizing before presenting PV, battery, inverter, BoQ, investment, savings or financing figures.

Subject to final site survey, equipment availability, and engineering approval.`
    : isEngineerView
    ? `SOLARISE PRO - SYSTEM PROPOSAL

Client: ${project.client}
Location: ${project.location}
System Type: ${project.systemType}
Prepared By: ${project.preparedBy}

System Size: ${num(sizing.actualKwp, 2)} kWp
PV Panels: ${sizing.panels} x ${project.panelW}W
Battery Bank: ${num(sizing.batteryKwh, 2)} kWh
Inverter: ${num(sizing.inverterKw, 1)} kW
Computed PR: ${pct(sizing.pr)}
P50 Annual Energy: ${num(sizing.annualEnergy, 0)} kWh/year
P90 Annual Energy: ${num(sizing.annualEnergyP90, 0)} kWh/year
Estimated CO2 Offset: ${num(sizing.carbonOffset, 2)} tCO2/year

Total Cost: ${money(sizing.totalCost)}
P50 Annual Savings: ${money(sizing.annualSavings)}
P90 DSCR: ${num(sizing.dscrYear1, 2)}
Simple Payback: ${num(sizing.payback, 2)} years
LCOE P50: ${num(sizing.lcoe, 2)} KES/kWh

Engineering checks: Cold Voc ${sizing.coldVocOk ? "OK" : "NOT OK"}; DC drop ${pct(sizing.dcDropPct)}; AC drop ${pct(sizing.acDropPct)}.
${readinessLine ? `\n${readinessLine}` : ""}${prBlockers.length ? `\nUnresolved critical items: ${prBlockers.map((b) => b.label).join("; ")}.` : ""}${prWarnings.length ? `\nOpen warnings: ${prWarnings.join("; ")}.` : ""}${prNightCaution ? `\nNight-load caution: ${prNightCaution}` : ""}

Assumptions: figures use standard derating, assumed tariff and irradiance for the site profile, and an 11-hour night window for backup estimates. Backup duration depends on real load behaviour and battery condition.

Subject to final site survey, equipment availability, and engineering approval.`
    : isTechnicianView
    ? `SOLARISE PRO - TECHNICIAN INSTALLATION SUMMARY

Client: ${project.client}
Location: ${project.location}
System Type: ${project.systemType}

System Size: ${num(sizing.actualKwp, 2)} kWp
PV Panels: ${sizing.panels} x ${project.panelW}W
Battery Bank: ${num(sizing.batteryKwh, 2)} kWh
Inverter: ${num(sizing.inverterKw, 1)} kW

Technician note: Commercial prices, margins and financing details are hidden in Technician View. Confirm all site conditions during survey and commissioning.`
    : `SOLARISE PRO - SYSTEM PROPOSAL

Client: ${project.client}
Location: ${project.location}
System Type: ${project.systemType}
Monthly bill reference: ${money(project.monthlyBill)}

System Size: ${num(sizing.actualKwp, 2)} kWp
PV Panels: ${sizing.panels} x ${project.panelW}W
Battery Bank: ${num(sizing.batteryKwh, 2)} kWh
Inverter: ${num(sizing.inverterKw, 1)} kW
P50 Annual Energy: ${num(sizing.annualEnergy, 0)} kWh/year

Total Investment: ${money(sizing.totalCost)}
${commercialClaimsBlocked ? `Estimated Annual Savings: Pending bill/load reconciliation\nReconciliation note: ${billLoadMessage}` : `Estimated Annual Savings: ${money(sizing.annualSavings)}`}
Simple Payback: ${num(sizing.payback, 2)} years
LCOE P50: ${num(sizing.lcoe, 2)} KES/kWh

Assumptions: feasibility estimate using the recorded bill, tariff and site profile. Default survey values are assumptions until confirmed on site.

Subject to final site survey, equipment availability, and engineering approval.`;

  const copy = async () => {
    if (loadQuoteBlocked) { showToast(proposalBlockedLabel, "error"); return; }
    try {
      const equipmentText = sizing.equipment?.enabled && !loadQuoteBlocked ? `\n\nDocumented equipment matching: ${sizing.equipment.status}\nPV: ${sizing.equipment.models.panel}\nInverter: ${sizing.equipment.models.inverter}\nBattery: ${sizing.batteryModules} x ${sizing.equipment.models.battery}\nPrice basis: ${sizing.equipment.commercialBasis === "SUPPLIER_QUOTE" ? `Supplier reference ${project.equipmentSelection.priceReference}` : "Planning estimate, not a supplier offer"}\nSource set: ${sizing.equipment.catalogueVersion}\n${sizing.equipment.scope}` : "";
      await navigator.clipboard.writeText(proposalText + equipmentText);
      showToast("Proposal copied to clipboard.");
    } catch {
      showToast("Failed to copy proposal text.", "error");
    }
  };

  // v11.4 — PDF generation with a visible loading state, disabled buttons and
  // a success/failure toast. jsPDF is synchronous, so yield a frame first so
  // React can paint the spinner before the main thread blocks.
  const [pdfBusy, setPdfBusy] = useState(null);
  // v11.7 — formal three-mode + lender reports.
  const [reportBusy, setReportBusy] = useState(null);
  const genReport = (mode) => {
    if (reportBusy) return;
    if (!visibleReportModes.includes(mode)) {
      showToast("This report mode is only available in Engineer View.", "error");
      return;
    }
    if (loadQuoteBlocked) {
      showToast(`${proposalBlockedLabel}: complete loads before exporting proposal reports.`, "error");
      return;
    }
    if (selectedDesignStale) {
      showToast("STALE_DESIGN: select a system option calculated from the current project inputs.", "error");
      return;
    }
    setReportBusy(mode);
    setTimeout(async () => {
      try {
        if (cloudEnabled) await onPrepareVersion?.("prepared", mode);
        const report = buildReport(mode, {
          project, sizing, readiness: projectReadiness, borehole,
          boreholeChecklist: project.borehole?.enabled && borehole ? summarizeBoreholeForTechnician(project.borehole, borehole) : null,
          evidence: project.evidence,
        });
        const { downloadReportPdf } = await import("./utils/reportPdf.js");
        downloadReportPdf(report);
        recordAudit(AUDIT_EVENT_TYPES.PDF_EXPORTED, `${REPORT_LABELS[mode]} report`, { projectRef: project.projectRef?.reference || null, user: project.preparedBy });
        if (mode === "client") recordAudit(AUDIT_EVENT_TYPES.PROPOSAL_GENERATED, "Client proposal report", { user: project.preparedBy });
        if (setProject) setProject((p) => ({ ...p, evidence: markReportGenerated(p.evidence) }));
        showToast(`${REPORT_LABELS[mode]} downloaded.`);
      } catch (err) {
        showToast(`Report generation failed: ${err?.message || "unknown error"}`, "error");
      } finally {
        setReportBusy(null);
      }
    }, 50);
  };
  // v11.5.2 — proposal gate: intercept generation when the central engine
  // reports critical blockers or required-missing items. Warn, don't hard-block.
  const [pdfGate, setPdfGate] = useState(null);
  const doPdf = (kind, generate) => {
    if (pdfBusy) return;
    setPdfBusy(kind);
    setTimeout(async () => {
      try {
        if (cloudEnabled) await onPrepareVersion?.("prepared", kind);
        await generate();
        showToast(kind === "full" ? "Full report downloaded." : "PDF quotation downloaded.");
      } catch (err) {
        showToast(`PDF generation failed: ${err?.message || "unknown error"}`, "error");
      } finally {
        setPdfBusy(null);
      }
    }, 50);
  };
  const runPdf = (kind, generate) => {
    if (pdfBusy) return;
    if (!canShowInternalProposal) {
      showToast("Internal quotation exports are only available in Engineer View.", "error");
      return;
    }
    if (selectedDesignStale) {
      showToast("STALE_DESIGN: select a system option calculated from the current project inputs.", "error");
      return;
    }
    if (loadQuoteBlocked) {
      showToast(`${proposalBlockedLabel}: complete loads before exporting quote-ready PDFs.`, "error");
      return;
    }
    if (prBlockers.length > 0 || prRequiredMissing.length > 0) {
      setPdfGate({ kind, generate });
      showToast(`Action needed: ${prBlockers.length + prRequiredMissing.length} item(s) to review before proposal.`, "error");
      return;
    }
    doPdf(kind, generate);
  };

  return (
    <div className="proposal-grid">
      {billLoadReconciliation?.clientClaimsBlocked && (
        <WarningPanel tone="warning" title="Bill and captured loads require reconciliation">
          {billLoadMessage} Captured-load coverage and savings as a percentage of bill are separate measures; client claims remain provisional until the mismatch, tariff and non-energy charges are resolved.
        </WarningPanel>
      )}
      {isEngineerView && inventoryWarnings.length > 0 && (
        <WarningPanel tone="warning" title="Procurement readiness is not confirmed">
          {inventoryWarnings.length} selected technical asset(s) do not have confirmed current availability. Confirm supplier stock and selling price before approval or procurement.
        </WarningPanel>
      )}
      <div className="proposal-preview-sheet">
        <div className="proposal-watermark">
          <div className="proposal-sub">Solarise Pro powered by Voltflow</div>
          <h1 className="proposal-main-title">System Proposal</h1>
          <p className="card-subtitle">Quality solar + hybrid energy systems for homes, businesses, and communities in Kenya.</p>
        </div>
        <div className="proposal-meta-row">
          <div className="proposal-meta-item">
            <span className="meta-label">Client</span>
            <span className="meta-val">{project.client}</span>
          </div>
          <div className="proposal-meta-item">
            <span className="meta-label">Location</span>
            <span className="meta-val">{project.location}</span>
          </div>
          <div className="proposal-meta-item">
            <span className="meta-label">System Type</span>
            <span className="meta-val">{project.systemType}</span>
          </div>
          <div className="proposal-meta-item">
            <span className="meta-label">Prepared By</span>
            <span className="meta-val">{project.preparedBy}</span>
          </div>
        </div>
        {sizing.equipment?.enabled && <div className="equipment-notice" style={{ marginTop: "1rem" }}>
          <strong>Equipment matching: {sizing.equipment.status}</strong>
          <p>{sizing.equipment.models.panel || "PV module unverified"} · {sizing.equipment.models.inverter || "Inverter unverified"} · {sizing.batteryModules} × {sizing.equipment.models.battery || "Battery unverified"}</p>
          <p>{sizing.equipment.commercialBasis === "SUPPLIER_QUOTE" ? `Supplier quote reference: ${project.equipmentSelection.priceReference || "missing"}` : "Prices are planning estimates, not a supplier offer."} {sizing.equipment.scope}</p>
        </div>}
        {canShowCommercialProposal && billLoadReconciliation && (
          <div className="grid-cols-2" style={{ marginTop: "1rem" }}>
            <Metric
              label="Captured load coverage"
              value={Number.isFinite(billLoadReconciliation.capturedLoadCoveragePct) ? pct(billLoadReconciliation.capturedLoadCoveragePct) : "Pending reconciliation"}
              hint={billLoadReconciliation?.energyBasis === "recorded_bill_kwh" ? "Itemized kWh divided by recorded bill kWh" : "Itemized kWh divided by bill-implied kWh"}
            />
            <Metric
              label="Savings vs referenced bill"
              value={Number.isFinite(billLoadReconciliation.savingsPctOfBill) ? pct(billLoadReconciliation.savingsPctOfBill) : "Pending reconciliation"}
              hint="Estimated monthly savings divided by monthly bill"
            />
          </div>
        )}
        {loadQuoteBlocked && (
          <WarningPanel tone="warning" title={proposalBlockedLabel}>
            This proposal is on hold. {proposalBlockedHint}
          </WarningPanel>
        )}
        {canShowCommercialProposal && sizing.tariffSummary && <WarningPanel tone="info" title="Reviewed tariff savings forecast">
          {sizing.tariffSummary.category} · {sizing.tariffSummary.billingMonth} · reference bill {money(sizing.tariffSummary.beforeKes)}, after-solar estimate {money(sizing.tariffSummary.afterKes)}. Fixed and demand charges are retained. {sizing.tariffSummary.assumption} Recorded review only, not utility certification.
        </WarningPanel>}
        <div className="grid-cols-4" style={{ marginTop: "2rem" }}>
          <Metric label="PV SIZE" value={loadQuoteBlocked ? proposalBlockedLabel : `${num(sizing.actualKwp, 1)} kWp`} hint={loadQuoteBlocked ? proposalBlockedHint : `${sizing.panels} panels`} />
          <Metric label="BATTERY CAPACITY" value={loadQuoteBlocked ? proposalBlockedLabel : `${num(sizing.batteryKwh, 1)} kWh`} hint={loadQuoteBlocked ? proposalBlockedHint : batteryChemistries[project.batteryChemistry].label} />
          <Metric label="INVERTER RATING" value={loadQuoteBlocked ? proposalBlockedLabel : `${num(sizing.inverterKw, 1)} kW`} hint={loadQuoteBlocked ? proposalBlockedHint : project.phase} />
          {canShowCommercialProposal && <Metric label="CAPEX" value={loadQuoteBlocked ? proposalBlockedLabel : money(sizing.totalCost)} hint={loadQuoteBlocked ? proposalBlockedHint : undefined} />}
        </div>
        {canShowCommercialProposal && <div className="grid-cols-2" style={{ marginTop: "1.5rem" }}>
          <div className="metric-card good">
            <div className="metric-label">Estimated P50 Annual Savings</div>
            <div className="metric-value">{loadQuoteBlocked ? proposalBlockedLabel : money(sizing.annualSavings)}</div>
          </div>
          {isEngineerView ? (
            <div className="metric-card">
              <div className="metric-label">P90 DSCR Coverage Ratio</div>
              <div className="metric-value">{loadQuoteBlocked ? proposalBlockedLabel : project.debtShare > 0 ? num(sizing.dscrYear1, 2) : "N/A"}</div>
            </div>
          ) : (
            <div className="metric-card">
              <div className="metric-label">Monthly bill reference</div>
              <div className="metric-value">{money(project.monthlyBill)}</div>
            </div>
          )}
        </div>}
        {canShowCommercialProposal && !loadQuoteBlocked && (
          <div style={{ marginTop: "1rem", padding: "0.85rem 1rem", border: "1px solid #dbe4ee", background: "#f8fafc", borderRadius: "0.5rem" }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 800, marginBottom: "0.55rem" }}>Proposal Price Breakdown</div>
            <div className="grid-cols-4">
              <Metric label="Equipment" value={money(quote.category_totals?.EQUIPMENT || 0)} />
              <Metric label="Labour" value={money(quote.category_totals?.LABOUR || 0)} />
              <Metric label="Transport" value={money(quote.category_totals?.TRANSPORT || 0)} />
              <Metric label="Other" value={money(quote.category_totals?.OTHER || 0)} />
              <Metric label="Discount" value={money(-(quote.discount || 0))} />
              <Metric label="Subtotal ex VAT" value={money(quote.subtotal_net || 0)} />
              <Metric label="VAT" value={money(quote.tax || 0)} hint={quote.tax_rule_version || project.taxRuleVersion} />
              <Metric label="Total inc VAT" value={money(quote.total_gross || 0)} />
            </div>
          </div>
        )}
        {/* v8 Client Explanation */}
        {clientExp && (
          <div style={{ marginTop:"1.25rem", padding:"1rem 1.1rem", background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:"0.6rem" }}>
            <div style={{ fontWeight:700, fontSize:"0.85rem", color:"#92400e", marginBottom:"0.75rem" }}>CLIENT EXPLANATION</div>
            {[["What we found", clientExp.whatWeFound], ["What we recommend", clientExp.recommendation], ["What this system will do", clientExp.whatItWillDo], ["What it will not do", clientExp.whatItWillNot], ["Expected savings", clientExp.savings]].map(([heading, text]) => (
              <div key={heading} style={{ marginBottom:"0.6rem" }}>
                <div style={{ fontWeight:700, fontSize:"0.78rem", color:"#78350f", marginBottom:"0.15rem" }}>{heading}</div>
                <div style={{ fontSize:"0.82rem", color:"#451a03", lineHeight:1.55 }}>{text}</div>
              </div>
            ))}
            {clientExp.nextSteps && <div style={{ fontWeight:700, fontSize:"0.78rem", color:"#78350f", marginBottom:"0.15rem" }}>Next steps</div>}
            {clientExp.nextSteps && <div style={{ fontSize:"0.82rem", color:"#451a03", lineHeight:1.55 }}>{clientExp.nextSteps}</div>}
          </div>
        )}
        {canShowInternalProposal && readiness && (
          <div style={{ marginTop:"0.75rem", padding:"0.5rem 0.85rem", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:"0.4rem", fontSize:"0.78rem", color:"#64748b" }}>
            <b>Readiness:</b> {readiness.readyStatus} ({readiness.totalScore}/100)
            {readiness.blockers.length > 0 && <span style={{ color:"#ef4444", marginLeft:"0.5rem" }}> · {readiness.blockers.length} blocker(s) unresolved</span>}
          </div>
        )}
        {/* v11.5.2 — central-engine readiness, open warnings and night-load caution */}
        {canShowInternalProposal && pr && (prBlockers.length > 0 || prWarnings.length > 0 || prNightCaution) && (
          <div style={{ marginTop:"0.5rem", padding:"0.6rem 0.85rem", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:"0.4rem", fontSize:"0.78rem", color:"#7f1d1d", lineHeight:1.55 }}>
            <div style={{ fontWeight:700, marginBottom:"0.25rem" }}>⚠ Unresolved before final issue ({prBlockers.length + prWarnings.length + (prNightCaution ? 1 : 0)})</div>
            <ul style={{ margin:0, paddingLeft:"1.1rem" }}>
              {prBlockers.map((b, i) => <li key={`b${i}`}>{b.label}</li>)}
              {prWarnings.map((w, i) => <li key={`w${i}`}>{w}</li>)}
              {prNightCaution && <li>{prNightCaution}</li>}
            </ul>
          </div>
        )}
        {/* v11.1 — Blueprint / New Construction Assumptions */}
        {project.sizingMode && project.sizingMode !== "existing_site" && (
          <div style={{ marginTop:"1rem", padding:"0.85rem 1rem", background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:"0.6rem" }}>
            <div style={{ fontWeight:700, fontSize:"0.85rem", color:"#92400e", marginBottom:"0.5rem" }}>
              📐 BLUEPRINT / NEW CONSTRUCTION ASSUMPTIONS
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))", gap:"0.4rem", fontSize:"0.78rem", color:"#78350f", marginBottom:"0.5rem" }}>
              <span><b>Sizing basis:</b> {project.sizingMode === "blueprint_new_build" ? "Blueprint / new construction" : "Future expansion"}</span>
              <span><b>Building type:</b> {(BLUEPRINT_TEMPLATES.find(t => t.key === project.blueprint?.buildingType) || {}).label || "—"}</span>
              <span><b>Floor area:</b> {project.blueprint?.floorAreaM2 || "—"} m²</span>
              <span><b>Occupancy:</b> {project.blueprint?.occupancy || "—"}</span>
              <span><b>Schedule:</b> {project.blueprint?.scheduleHoursPerDay || "—"} h/day</span>
              <span><b>Growth margin:</b> {project.blueprint?.futureGrowthPct ?? "—"}%</span>
              <span><b>Confidence:</b> {project.blueprint?.confidenceLevel || "medium"}</span>
            </div>
            <div style={{ fontSize:"0.78rem", color:"#92400e", fontStyle:"italic", lineHeight:1.5 }}>
              This proposal is based on blueprint-stage assumptions. Final sizing must be reviewed once the equipment schedule, MEP drawings, or actual operating loads are confirmed.
            </div>
          </div>
        )}
        {/* v11.2 — Energy Data Source */}
        {project.energyImport && (
          <div style={{ marginTop:"1rem", padding:"0.85rem 1rem", background:"#eff6ff", border:"1px solid #93c5fd", borderRadius:"0.6rem" }}>
            <div style={{ fontWeight:700, fontSize:"0.85rem", color:"#1e3a8a", marginBottom:"0.5rem" }}>
              📊 ENERGY DATA SOURCE
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(170px, 1fr))", gap:"0.4rem", fontSize:"0.78rem", color:"#1e3a8a", marginBottom:"0.5rem" }}>
              <span><b>Data source:</b> {project.energyImport.source}</span>
              <span><b>Date range:</b> {project.energyImport.dateRange?.start ? `${project.energyImport.dateRange.start.slice(0, 10)} → ${project.energyImport.dateRange.end.slice(0, 10)} (${project.energyImport.dateRange.days} d)` : "—"}</span>
              <span><b>Records analysed:</b> {project.energyImport.cleanedRecords || project.energyImport.totalRecords} @ {project.energyImport.intervalMinutes} min</span>
              <span><b>Average daily:</b> {num(project.energyImport.averageDailyKwh, 1)} kWh</span>
              <span><b>Peak demand:</b> {num(project.energyImport.peakDemandKw, 2)} kW (P95 {num(project.energyImport.p95DemandKw, 2)} kW)</span>
              <span><b>Data quality score:</b> {project.energyImport.dataQualityScore}/100 · {project.energyImport.profileConfidence} confidence</span>
            </div>
            <div style={{ fontSize:"0.78rem", color:"#1e40af", lineHeight:1.5 }}>
              <b>Key assumptions:</b> day window 06:00–18:00 site local time; base load {num(project.energyImport.baseLoadKw, 2)} kW;
              day/night split {project.energyImport.dayNightSplit?.dayPct}%/{project.energyImport.dayNightSplit?.nightPct}%;
              load factor {num(project.energyImport.loadFactor, 2)}. Measured data improves sizing confidence but does not replace
              site verification, equipment confirmation, and licensed engineering review.
            </div>
          </div>
        )}
        {!project.energyImport && project.loadSource !== "data_logger" && (
          <div style={{ marginTop:"0.75rem", padding:"0.5rem 0.85rem", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:"0.4rem", fontSize:"0.76rem", color:"#64748b" }}>
            <b>Energy data source:</b> {project.loadSource === "kplc_bill" ? "KPLC bill history" : project.loadSource === "measured" ? "Measured / survey data" : "Manual estimate"} — no interval logger data imported.
          </div>
        )}
        {canShowInternalProposal && <div className="proposal-notes-box">
          <b>Engineering configuration summary:</b> Performance Ratio is {pct(sizing.pr)}, cold string Voc voltage is {num(sizing.stringVocCold, 0)}V (limit {project.inverterMaxDcV}V), DC cable voltage drop is {pct(sizing.dcDropPct)}, AC cable drop is {pct(sizing.acDropPct)}, and P90 annual yield is {num(sizing.annualEnergyP90, 0)} kWh/year.
        </div>}
        {(project.systemType === "Solar PV – Hybrid" || project.systemType === "Genset hybrid") && (
          <div className="alert-box" style={{ marginTop: "1rem", border: "1px solid #fca5a5", backgroundColor: "#fef2f2", color: "#7f1d1d", lineHeight: 1.5 }}>
            ⚠️ <b>KPLC / EPRA Notice:</b> Grid-tied and genset-hybrid inverters must have certified anti-islanding protection per EPRA standards. A Generation Licence or EPRA Exemption is required under the Kenya Energy Act 2019 before connection to KPLC supply. This proposal is subject to final EPRA and KPLC interconnection approval.
          </div>
        )}
        {canShowInternalProposal && <div style={{ marginTop:"1rem", padding:"0.85rem 1rem", background:"#f0fdf4", border:"1px solid #86efac", borderRadius:"0.5rem", fontSize:"0.82rem", color:"#166534", lineHeight:1.6 }}>
          <b>Engineering compliance summary:</b> Cold Voc {sizing.coldVocOk ? "✅ OK" : "❌ FAIL"} | DC drop {pct(sizing.dcDropPct)} {sizing.dcDropPct <= 0.015 ? "✅" : "⚠️"} | AC drop {pct(sizing.acDropPct)} {sizing.acDropPct <= 0.03 ? "✅" : "⚠️"} | BMS discharge {sizing.batteryInputA <= sizing.bmsMaxDischargeA ? "✅ OK" : "⚠️ Exceeds"} | DC cable {sizing.dcCableAmpacityOk ? "✅" : "⚠️"} | AC cable {sizing.acCableAmpacityOk ? "✅" : "⚠️"} | Earthing {withSurveyAssumption("earthingAvailable", survey?.earthingAvailable ? "Available" : "Not confirmed", survey)}
        </div>}
        <div style={{ marginTop:"0.75rem", padding:"0.75rem 1rem", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:"0.5rem", fontSize:"0.78rem", color:"#64748b", lineHeight:1.6 }}>
          <b>Disclaimers:</b> (1) <b>Engineering:</b> Final cable ampacity, protection coordination, earthing/bonding, SPD selection, grid interconnection settings, and commissioning must be verified by a qualified licensed electrical engineer. (2) <b>Financial:</b> LCOE and payback are feasibility estimates. Use confirmed supplier quotations, tax treatment, and financing terms for investment decisions. (3) <b>Carbon:</b> Carbon revenue is indicative only and excluded from base cashflow unless explicitly enabled. Formal claims require third-party MRV validation.
        </div>

        {/* v11.4 — client-facing commercial sections */}
        {canShowCommercialProposal && !loadQuoteBlocked && <div style={{ marginTop: "1.5rem", borderTop: "2px solid var(--color-primary)", paddingTop: "1.15rem" }}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-main)", marginBottom: "0.9rem" }}>Investment &amp; next steps</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "0.5rem", padding: "0.75rem 0.9rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#166534", letterSpacing: "0.05em" }}>TOTAL INVESTMENT</div>
              <div style={{ fontSize: "1.15rem", fontWeight: 900, color: "#065f46", marginTop: "0.2rem" }}>{money(sizing.totalCost)}</div>
              <div style={{ fontSize: "0.72rem", color: "#166534", marginTop: "0.15rem" }}>Indicative, VAT &amp; contingency included</div>
            </div>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "0.75rem 0.9rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#475569", letterSpacing: "0.05em" }}>PAYMENT TERMS</div>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0f172a", marginTop: "0.2rem" }}>To be confirmed</div>
              <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.15rem" }}>Deposit / milestone schedule agreed before works begin</div>
            </div>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "0.75rem 0.9rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#475569", letterSpacing: "0.05em" }}>QUOTATION VALIDITY</div>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0f172a", marginTop: "0.2rem" }}>Subject to confirmation</div>
              <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.15rem" }}>Equipment pricing and availability change</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.8rem", color: "#7f1d1d", marginBottom: "0.35rem" }}>Not included (exclusions)</div>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.78rem", color: "#475569", lineHeight: 1.8 }}>
                <li>Civil works, trenching, roof strengthening or waterproofing repairs</li>
                <li>Utility (KPLC) application fees, meter changes or grid upgrades</li>
                <li>Existing distribution board rework beyond the connection point</li>
                <li>Generator supply or major rewiring of existing circuits</li>
                <li>Anything not explicitly listed in the bill of quantities</li>
              </ul>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.8rem", color: "#166534", marginBottom: "0.35rem" }}>Next steps</div>
              <ol style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.78rem", color: "#475569", lineHeight: 1.8 }}>
                <li>Client reviews this proposal and raises questions</li>
                <li>Equipment schedule and final pricing confirmed with suppliers</li>
                <li>Qualified engineer reviews and signs off the final design</li>
                <li>Agreement signed and installation scheduled</li>
                <li>Installation, commissioning and handover documentation</li>
              </ol>
            </div>
          </div>

          {boreholeProp && (
            <div style={{ marginTop: "1rem", padding: "0.9rem 1.1rem", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "0.6rem" }}>
              <div style={{ fontWeight: 800, fontSize: "0.9rem", color: "#1e3a8a", marginBottom: "0.5rem" }}>💧 Solar Borehole & Water Pumping Solution</div>
              <div style={{ fontSize: "0.83rem", color: "#1e3a8a", lineHeight: 1.6, marginBottom: "0.5rem" }}>{boreholeProp.headline}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem 1.25rem", fontSize: "0.8rem", color: "#1e40af", fontWeight: 600 }}>
                <span>Use case: {boreholeProp.useCase}</span>
                <span>Water: ~{Math.round(boreholeProp.dailyWaterDemandLitres).toLocaleString()} L/day</span>
                <span>Head: ~{Math.round(boreholeProp.totalDynamicHeadM)} m TDH</span>
                <span>Pump: ~{boreholeProp.suggestedPumpHp} HP</span>
                <span>Solar: {boreholeProp.recommendedPvKwp} kWp ({boreholeProp.estimatedPanels} panels)</span>
                <span>Tank: {Math.round(boreholeProp.recommendedTankLitres).toLocaleString()} L</span>
                <span>Strategy: {boreholeProp.pumpingStrategy}</span>
              </div>
              {boreholeProp.protectionIncluded.length > 0 && <div style={{ fontSize: "0.78rem", color: "#1e40af", marginTop: "0.4rem" }}>Protection included: {boreholeProp.protectionIncluded.join(", ")}.</div>}
              <div style={{ fontSize: "0.76rem", color: "#334155", marginTop: "0.4rem", lineHeight: 1.5 }}>
                Assumptions & exclusions: final pump selection must be confirmed against the borehole test report, pump curve, measured water level, yield and pipe route.
                {boreholeProp.reviewRequired && <b style={{ color: "#b91c1c" }}> Engineering review recommended before issuing the final quotation.</b>}
              </div>
            </div>
          )}

          <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "0.5rem", fontSize: "0.8rem", color: "#78350f", fontWeight: 600, lineHeight: 1.6 }}>
            This is a feasibility quotation and proposal support document. Final engineering design and installation approval require qualified review.
          </div>
        </div>}

        {survey && survey.clientName && (
          <div style={{ marginTop: "1.5rem", borderTop: "2px solid var(--color-primary)", paddingTop: "1rem" }}>
            <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "0.75rem", color: "var(--color-primary)" }}>Field Survey Summary</div>
            {[
              ["Client", survey.clientName],
              ["Phone", survey.phone],
              ["Email", survey.email],
              ["Site Address", survey.siteAddress],
              ["County", survey.county],
              ["Site Type", survey.siteType],
              ["Survey Date", survey.surveyDate],
              ["Surveyor", survey.surveyor],
              ["Roof Type", survey.roofType],
              ["Roof Condition", withSurveyAssumption("roofCondition", survey.roofCondition, survey)],
              ["Roof Area", withSurveyAssumption("roofAreaM2", `${survey.roofAreaM2} m²`, survey)],
              ["Phase", survey.phaseType],
              ["Main Breaker", withSurveyAssumption("mainBreakerA", `${survey.mainBreakerA} A`, survey)],
              ["DB Condition", survey.dbCondition],
              ["Earthing", withSurveyAssumption("earthingAvailable", survey.earthingAvailable ? "Available" : "⚠ Not available — add to BoQ", survey)],
              ["Wiring", survey.wiringCondition],
              ["Shading", survey.shadingSources.length === 0 || survey.shadingSources.includes("None") ? "None" : survey.shadingSources.join(", ")],
              ["Site Notes", survey.siteNotes || "—"],
              ["Photos", `${Object.values(survey.photos).filter(Boolean).length} of 10 captured`],
              ["Engineer Recommendation", survey.engineerRecommendation || "—"],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-light)", fontSize: "12.5px" }}>
                <span style={{ color: "var(--text-muted)" }}>{k}</span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            {canShowInternalProposal && survey.dbCondition === "Needs upgrade" && (
              <div style={{ marginTop: "0.5rem", fontSize: "12px", color: "#92400e", background: "#fffbeb", padding: "8px 10px", borderRadius: "8px" }}>
                ⚠ DB upgrade required — include in BoQ.
              </div>
            )}
            {canShowInternalProposal && !survey.earthingAvailable && (
              <div style={{ marginTop: "0.5rem", fontSize: "12px", color: "#92400e", background: "#fffbeb", padding: "8px 10px", borderRadius: "8px" }}>
                ⚠ Earthing installation required — include in BoQ.
              </div>
            )}
          </div>
        )}

        {/* Roof Layout & Installation Assumptions section */}
        {panelLayout && roofGeometry && (
          <div style={{ marginTop: "1.5rem", borderTop: "2px solid #e2e8f0", paddingTop: "1rem" }}>
            <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "0.75rem", color: "#0f172a" }}>Roof Layout & Installation Assumptions</div>
            {[
              ["Roof Type", survey?.roofType],
              ["Roof Condition", withSurveyAssumption("roofCondition", survey?.roofCondition, survey)],
              ["Usable Roof Area", withSurveyAssumption("roofAreaM2", `${(roofGeometry.roofAreaUsableM2 || 0).toFixed(1)} m²`, survey)],
              ["Roof Capture Method", survey?.roofInputMode?.replace(/_/g, " ")],
              ["Data Confidence", roofGeometry.roofCaptureConfidence],
              ["Panels Required", `${panelLayout.requiredPanels}`],
              ["Estimated Panels That Fit", `${panelLayout.estimatedPanelsThatFit || "—"}`],
              ["Roof Fit Status", panelLayout.roofFitStatus],
              ["Recommended Orientation", panelLayout.recommendedPanelOrientation],
              ["Recommended Tilt", tiltGuidance ? `${tiltGuidance.recommendedTiltDeg}°` : "—"],
              ["Orientation Guidance", tiltGuidance?.azimuthComment],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f1f5f9", fontSize: "12.5px" }}>
                <span style={{ color: "#64748b" }}>{k}</span>
                <span style={{ fontWeight: 600, maxWidth: "60%", textAlign: "right" }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: "0.75rem", padding: "0.6rem 0.85rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.77rem", color: "#64748b", lineHeight: 1.6 }}>
              ⚠ <strong>Disclaimer:</strong> Roof layout is based on survey/coordinate/blueprint inputs and is subject to final on-site verification, structural suitability, roof condition, wind loading, clamp zones, waterproofing, and installer safety review. Final structural design must be approved by a qualified engineer.
            </div>
          </div>
        )}

        {/* Installation Layout Assumptions — from Installer Simulation */}
        {simulation && (
          <div style={{ marginTop: "1.5rem", borderTop: "2px solid #e2e8f0", paddingTop: "1rem" }}>
            <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "0.75rem", color: "#0f172a" }}>Installation Layout Assumptions</div>
            {[
              ["Roof Fit Status", panelLayout?.roofFitStatus?.split("—")[0]?.trim()],
              ["Panels Required", panelLayout?.requiredPanels ? `${panelLayout.requiredPanels}` : undefined],
              ["Estimated roof capacity (panels)", panelLayout?.estimatedPanelsThatFit ? `${panelLayout.estimatedPanelsThatFit}` : undefined],
              ["Recommended Orientation", panelLayout?.recommendedPanelOrientation],
              ["Inverter Location", simulation.inverterLocation?.replace(/_/g, " ")],
              ["Battery Location", simulation.batteryLocation?.replace(/_/g, " ")],
              ["Cable Entry Point", simulation.cableEntryPoint],
              ["DC Route Est.", simulation.dcRouteCustomM > 0 ? `${simulation.dcRouteCustomM} m (manual)` : "Auto-estimated"],
              ["Obstructions", simulation.obstructions?.length > 0 ? simulation.obstructions.map(o => o.label).join(", ") : "None recorded"],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f1f5f9", fontSize: "12.5px" }}>
                <span style={{ color: "#64748b" }}>{k}</span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            {(canShowInternalProposal || isTechnicianView) && simWarnings && simWarnings.filter(w => w.level === "danger").length > 0 && (
              <div style={{ marginTop: "0.5rem" }}>
                {simWarnings.filter(w => w.level === "danger").map((w, i) => (
                  <div key={i} style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "0.4rem", padding: "0.4rem 0.7rem", marginBottom: "0.3rem", fontSize: "0.77rem", color: "#7f1d1d", fontWeight: 600 }}>
                    ⛔ {w.msg}
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: "0.75rem", padding: "0.6rem 0.85rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.77rem", color: "#64748b", lineHeight: 1.6 }}>
              ⚠ <strong>Installer simulation disclaimer:</strong> This simulation is a technician planning guide only. Final installation layout must be verified on site based on roof structure, clamp zones, waterproofing, wind loading, earthing, cable routing, and safety requirements.
            </div>
          </div>
        )}

        {/* v10 — Load Assessment & Accessories (BOS) summary */}
        {loadSummary && (
          <div style={{ marginTop: "1.5rem", borderTop: "2px solid #e2e8f0", paddingTop: "1rem" }}>
            <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "0.75rem", color: "#0f172a" }}>Load Assessment Summary — {loadSummary.mode}</div>
            {[
              ["Connected Load", `${num(loadSummary.connectedKw, 1)} kW`],
              ["Max Demand", `${num(loadSummary.maxDemandKw, 1)} kW`],
              ["Daily Energy", `${num(loadSummary.dailyKwh, 1)} kWh`],
              ["Critical / Backup Energy", `${num(loadSummary.criticalKwh, 1)} kWh`],
              ["Largest Motor", loadSummary.largestMotorName ? `${loadSummary.largestMotorName} (${num(loadSummary.largestMotorStartingKva, 1)} kVA start)` : undefined],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f1f5f9", fontSize: "12.5px" }}>
                <span style={{ color: "#64748b" }}>{k}</span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#475569", fontStyle: "italic" }}>{loadSummary.recommendation}</div>

            {(canShowInternalProposal || isTechnicianView) && loadWarnings && loadWarnings.filter(w => w.level === "danger").length > 0 && (
              <div style={{ marginTop: "0.5rem" }}>
                {loadWarnings.filter(w => w.level === "danger").map((w, i) => (
                  <div key={i} style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "0.4rem", padding: "0.4rem 0.7rem", marginBottom: "0.3rem", fontSize: "0.77rem", color: "#7f1d1d", fontWeight: 600 }}>
                    ⛔ {w.msg}
                  </div>
                ))}
              </div>
            )}

            {dataLoggerRecommendation?.recommended && (
              <div style={{ marginTop: "0.5rem", background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: "0.4rem", padding: "0.5rem 0.7rem", fontSize: "0.78rem", color: "#1e40af" }}>
                ℹ {dataLoggerRecommendation.note}
              </div>
            )}

            {canShowInternalProposal && accessoriesBoQ && (
              <div style={{ marginTop: "0.75rem" }}>
                <div style={{ fontWeight: 700, fontSize: "12.5px", marginBottom: "0.4rem", color: "#0f172a" }}>Accessories / BOS</div>
                {Object.entries(accessoriesBoQ.categories).filter(([, rows]) => rows.length > 0).map(([k, rows]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f1f5f9", fontSize: "12px" }}>
                    <span style={{ color: "#64748b" }}>{ACCESSORY_CATEGORY_LABELS[k] || k} ({rows.length} items)</span>
                    <span style={{ fontWeight: 600 }}>{money(rows.reduce((s, r) => s + r.total, 0))}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "12.5px", fontWeight: 700 }}>
                  <span>BOS subtotal (reference)</span>
                  <span>{money(accessoriesBoQ.totalCost)}</span>
                </div>
              </div>
            )}

            <div style={{ marginTop: "0.75rem", padding: "0.6rem 0.85rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.77rem", color: "#64748b", lineHeight: 1.6 }}>
              ⚠ Load and accessories figures are planning-level estimates. Commercial/industrial loads should be validated with data
              logging where recommended. Final BOS quantities must be confirmed on site before procurement.
            </div>
          </div>
        )}
      </div>

      <Card title="Actions" subtitle={canShowInternalProposal ? "Engineer-only exports plus sanitized copy/print controls." : "Sanitized proposal copy and print controls only."}>
        <div className="action-box-spacing">
          {canShowInternalProposal && (
            <>
          <button onClick={() => runPdf("quotation", async () => {
            const { generateQuotationPDF } = await import("./utils/pdfGenerator.js");
            return generateQuotationPDF(project, sizing, loadItemsV2);
          })}
            disabled={!!pdfBusy || loadQuoteBlocked} className="btn btn-accent btn-full">
            {pdfBusy === "quotation" ? <><Spinner /> Generating PDF…</> : "Download PDF Quotation 📥"}
          </button>
          <button onClick={() => runPdf("full", async () => {
            const { generateFullPDF } = await import("./utils/pdfGenerator.js");
            return generateFullPDF(project, sizing, loadItemsV2, simulation, panelLayout, stringPlan, { loadSummary, loadWarnings, dataLoggerRecommendation, accessoriesBoQ }, { roofGeometry, simWarnings });
          })}
            disabled={!!pdfBusy || loadQuoteBlocked} className="btn btn-primary btn-full">
            {pdfBusy === "full" ? <><Spinner /> Generating report…</> : "Download Full Report (+ Simulation + Load/BOS) 📋"}
          </button>
            </>
          )}
          <button onClick={copy} disabled={loadQuoteBlocked} className="btn btn-primary btn-full">
            Copy proposal text
          </button>
          <button onClick={() => { if (loadQuoteBlocked) { showToast(proposalBlockedLabel, "error"); return; } window.print(); }} disabled={loadQuoteBlocked} className="btn btn-secondary btn-full">
            Print Page Format
          </button>
          {canShowInternalProposal && (
            <button className="btn btn-secondary btn-full" type="button" disabled={loadQuoteBlocked} onClick={() => {
              navigateToTab("storage");
              showToast("Use Export current project JSON to download the complete project backup.");
            }}>
              Export Project JSON — backup tools
            </button>
          )}
        </div>
      </Card>

      {/* v11.7 — audience-specific evidence reports */}
      <Card title="Formal reports (PDF)" subtitle="Audience-specific: client-clean, engineer technical basis, technician checklists, or lender/grant readiness. All carry the feasibility disclaimer.">
        <div className="action-box-spacing">
          {visibleReportModes.map((mode) => (
            <button key={mode} onClick={() => genReport(mode)} disabled={!!reportBusy || loadQuoteBlocked}
              className={`btn btn-full ${mode === "client" ? "btn-accent" : mode === "lender" ? "btn-primary" : "btn-secondary"}`}>
              {reportBusy === mode ? <><Spinner /> Generating…</> : `${REPORT_LABELS[mode]} PDF`}
            </button>
          ))}
        </div>
        <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "0.5rem", lineHeight: 1.5 }}>
          Client report hides internal technical detail. Engineer includes the technical basis + limitations. Technician includes site/commissioning{project.borehole?.enabled ? "/borehole" : ""} checklists. Lender includes assumptions and unresolved risks. Not certified engineering approval.
        </div>
      </Card>

      {canShowInternalProposal && setProject && <ProposalStudioPanel project={project} setProject={setProject} />}

      {cloudEnabled && cloudProjectId && canShowInternalProposal && (
        <CloudReviewWorkflow
          platform={platform}
          organisationId={activeMembership.organisationId}
          projectId={cloudProjectId}
          actorRole={actorRole}
          onPrepareVersion={onPrepareVersion}
          showToast={showToast}
        />
      )}

      {cloudEnabled && cloudProjectId && canShowInternalProposal && (
        <CloudVersionHistory
          platform={platform}
          organisationId={activeMembership.organisationId}
          projectId={cloudProjectId}
          showToast={showToast}
        />
      )}

      {pdfGate && (
        <ProposalGateModal
          blockers={prBlockers}
          requiredMissing={prRequiredMissing}
          nightCaution={prNightCaution}
          onReview={() => {
            const target = prBlockers[0] || prRequiredMissing[0];
            setPdfGate(null);
            if (target && navigateToTab) navigateToTab(target.actionTab, { source: "proposal_gate", highlightId: target.highlightId });
          }}
          onContinue={() => {
            const g = pdfGate;
            setPdfGate(null);
            recordAudit(AUDIT_EVENT_TYPES.WARNING_OVERRIDDEN, `Proposal generated past ${prBlockers.length} blocker(s)`, { user: project.preparedBy });
            doPdf(g.kind, g.generate);
          }}
          onClose={() => setPdfGate(null)}
        />
      )}
    </div>
  );
}

// v11.5.2 — animated proposal gate. Warns (does not hard-block) when the central
// readiness engine reports critical blockers or required-missing items before a
// PDF is generated. Respects prefers-reduced-motion via the .vf-* animation CSS.
function ProposalGateModal({ blockers = [], requiredMissing = [], nightCaution, onReview, onContinue, onClose }) {
  const total = blockers.length + requiredMissing.length;
  return (
    <div className="vf-action-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Proposal readiness warning">
      <div className="vf-modal vf-pulse" onClick={(e) => e.stopPropagation()}>
        <div className="vf-modal-head">
          <span className="vf-modal-icon" aria-hidden="true">⚠</span>
          <div>
            <div className="vf-modal-title">Review before issuing this proposal</div>
            <div className="vf-modal-sub">{total} item(s) need attention. You can review them first, or continue with the internal-alpha disclaimer.</div>
          </div>
        </div>
        <div className="vf-modal-body">
          {blockers.length > 0 && (
            <div style={{ marginBottom: "0.6rem" }}>
              <div style={{ fontWeight: 800, fontSize: "0.8rem", color: "var(--text-main)", marginBottom: "0.35rem" }}>Critical blockers ({blockers.length})</div>
              {blockers.map((b, i) => <SimBadge key={i} level="danger">{b.label}</SimBadge>)}
            </div>
          )}
          {requiredMissing.length > 0 && (
            <div style={{ marginBottom: "0.6rem" }}>
              <div style={{ fontWeight: 800, fontSize: "0.8rem", color: "var(--text-main)", marginBottom: "0.35rem" }}>Required items outstanding ({requiredMissing.length})</div>
              {requiredMissing.slice(0, 6).map((m, i) => <SimBadge key={i} level="warning">{m.section}: {m.item}</SimBadge>)}
            </div>
          )}
          {nightCaution && (
            <div style={{ marginBottom: "0.6rem" }}>
              <div style={{ fontWeight: 800, fontSize: "0.8rem", color: "var(--text-main)", marginBottom: "0.35rem" }}>Night-load caution</div>
              <SimBadge level="warning">{nightCaution}</SimBadge>
            </div>
          )}
          <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", lineHeight: 1.55 }}>
            Voltflow Internal Alpha — controlled testing. A proposal issued with open items is a feasibility draft, not an engineering-approved design.
          </div>
        </div>
        <div className="vf-modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-accent" onClick={onReview}>Review first →</button>
          <button className="btn btn-primary" onClick={onContinue}>Continue anyway</button>
        </div>
      </div>
    </div>
  );
}

function Carbon({ project, setProject, sizing }) {
  const update = (k, v) => setProject((p) => ({ ...p, [k]: v }));
  const standardOptions = Object.entries(carbonStandards).map(([value, data]) => ({ value, label: data.label }));
  const factorOptions = Object.entries(emissionFactors).map(([value, data]) => ({ value, label: data.label }));
  const selectedRange = sizing.carbonStandardData.priceRangeUsd;
  let recommendationStyle = { border: "1px solid var(--border-medium)", backgroundColor: "var(--bg-main)", color: "var(--text-main)" };
  if (project.systemType === "Off-grid" || project.systemType === "Mini-grid") {
    recommendationStyle = { border: "1px solid #a7f3d0", backgroundColor: "#ecfdf5", color: "#065f46" };
  } else if (sizing.hasAdditionalityConcern) {
    recommendationStyle = { border: "1px solid #fde68a", backgroundColor: "#fef3c7", color: "#78350f" };
  }

  const updateStandard = (value) => {
    const standard = carbonStandards[value] || carbonStandards.VCS;
    setProject((p) => ({
      ...p,
      carbonStandard: value,
      carbonCreditingPeriod: standard.creditingPeriodYr,
      carbonPermanenceBuffer: standard.permanenceBuffer,
      carbonIssuanceFee: standard.issuanceFee,
      carbonPriceUsd: standard.priceRangeUsd.mid,
    }));
  };

  return (
    <div className="grid-cols-2">
      <Card title="Emission factor and methodology" subtitle="Kenya's low-carbon grid requires careful factor selection.">
        <div className="form-grid">
          <SelectField label="Emission Factor Source" value={project.emissionFactorSource} onChange={(v) => update("emissionFactorSource", v)} options={factorOptions} />
          <Metric label="Selected Factor" value={`${num(sizing.emissionFactorData.factor, 2)} kgCO₂/kWh`} />
          <SelectField label="Carbon Standard" value={project.carbonStandard} onChange={updateStandard} options={standardOptions} />
          <Metric label="Crediting Period" value={`${project.carbonCreditingPeriod} yrs`} />
          <Metric label="Registry" value={sizing.carbonStandardData.registry} />
          <Metric label="Methodology" value={sizing.carbonStandardData.renewableEnergyMethodology} />
        </div>
        <div className="carbon-info" style={{ marginTop: "1rem" }}>
          {sizing.emissionFactorData.note}
        </div>
        {sizing.hasAdditionalityConcern && (
          <div className="alert-box" style={{ marginTop: "1rem", lineHeight: "1.4" }}>
            Kenya's grid is already highly renewable. Grid-tied solar projects may struggle to demonstrate additionality under {sizing.carbonStandardData.label}. Off-grid and diesel displacement projects have stronger cases. Consult a carbon project developer before committing to registration.
          </div>
        )}
      </Card>

      <Card title="Credit generation calculation" subtitle="Gross credits minus buffer and registry deductions.">
        <div className="form-grid">
          <Field label="Crediting Period" type="number" value={project.carbonCreditingPeriod} onChange={(v) => update("carbonCreditingPeriod", clamp(v, 1, 30))} suffix="yrs" />
          <Field label="Permanence Buffer" type="number" value={project.carbonPermanenceBuffer} onChange={(v) => update("carbonPermanenceBuffer", clamp(v, 0, 0.4))} suffix="0-1" />
          <Field label="Issuance Fee" type="number" value={project.carbonIssuanceFee} onChange={(v) => update("carbonIssuanceFee", clamp(v, 0, 0.2))} suffix="0-1" />
          <Metric label="Annual Offset" value={`${num(sizing.carbonOffsetMethodology, 2)} tCO₂/yr`} />
          <Metric label="Gross Credits" value={`${num(sizing.carbonGrossCredits, 2)} tCO₂`} />
          <Metric label="Buffer Withheld" value={`${num(sizing.permanenceWithholding, 2)} tCO₂`} />
          <Metric label="Issuance Deduction" value={`${num(sizing.issuanceFeeDeduction, 2)} tCO₂`} />
          <Metric label="Net Tradeable Credits" value={`${num(sizing.netCarbonCredits, 2)} tCO₂`} good={sizing.netCarbonCredits > 0} />
          <Metric label="Annual Net Credits" value={`${num(sizing.annualNetCarbonCredits, 2)} tCO₂/yr`} />
          <Metric label="Lifetime Offset P50 / P90" value={`${num(sizing.lifetimeCarbonOffset, 2)} / ${num(sizing.lifetimeCarbonOffsetP90, 2)} tCO₂`} />
        </div>
      </Card>

      <Card title="Carbon revenue model" subtitle="Carbon price is converted from USD into KES.">
        <div className="form-grid">
          <Field label="Carbon Price" type="number" value={project.carbonPriceUsd} onChange={(v) => update("carbonPriceUsd", Math.max(v, 0))} suffix="USD/tCO₂" help={`${sizing.carbonStandardData.label} typical range: USD ${selectedRange.low}-${selectedRange.high}/tCO₂`} />
          <Field label="USD/KES Rate" type="number" value={project.usdKesRate} onChange={(v) => update("usdKesRate", Math.max(v, 1))} suffix="KES/USD" />
          <Metric label="Carbon Price KES" value={`${num(sizing.carbonPriceKesFromUsd, 0)} KES/tCO₂`} />
          <Metric label="Gross Carbon Revenue" value={money(sizing.grossCarbonRevenue)} />
          <Metric label="Net Carbon Revenue" value={money(sizing.netCarbonRevenue)} good={sizing.netCarbonRevenue > 0} danger={sizing.netCarbonRevenue < 0 && project.carbonStandard !== "Internal"} />
          <Metric label="Annual Net Revenue" value={money(sizing.annualNetCarbonRevenue)} />
          <Metric label="Carbon Share" value={pct(sizing.carbonShareOfRevenue)} hint="of annual project net revenue" />
        </div>
      </Card>

      <Card title="MRV and verification costs" subtitle="Verification and reporting costs often determine viability for small projects.">
        <div className="form-grid">
          <Field label="Verification Frequency" type="number" value={project.carbonVerificationFrequency} onChange={(v) => update("carbonVerificationFrequency", clamp(v, 1, 10))} suffix="yrs" />
          <Field label="Verification Cost" type="number" value={project.carbonVerificationCostKes} onChange={(v) => update("carbonVerificationCostKes", Math.max(v, 0))} suffix="KES/event" />
          <Field label="Annual MRV Cost" type="number" value={project.carbonMrvCostKes} onChange={(v) => update("carbonMrvCostKes", Math.max(v, 0))} suffix="KES/yr" />
          <Metric label="Verification Events" value={num(sizing.totalVerificationEvents, 0)} />
          <Metric label="Verification Cost" value={money(sizing.totalVerificationCost)} />
          <Metric label="Total MRV Cost" value={money(sizing.totalMrvCost)} />
          <Metric label="Total Admin Cost" value={money(sizing.totalCarbonAdminCost)} />
          <Metric label="Break-even Price" value={`${num(sizing.breakEvenCarbonPriceUsd, 2)} USD/tCO₂`} danger={sizing.breakEvenCarbonPriceUsd > project.carbonPriceUsd && project.carbonStandard !== "Internal"} good={sizing.breakEvenCarbonPriceUsd <= project.carbonPriceUsd && project.carbonStandard !== "Internal"} />
        </div>
      </Card>

      <Card title="Kenya-specific carbon assessment" subtitle="Use this before presenting carbon revenue in a binding proposal." style={{ gridColumn: "1 / -1" }}>
        <div className="carbon-info">
          <b>Kenya grid note:</b> {sizing.carbonStandardData.kenyaGridNote}
        </div>
        <div className="carbon-rec-banner" style={recommendationStyle}>
          {sizing.carbonRecommendation}
        </div>
        <div className="carbon-info" style={{ marginTop: "1rem" }}>
          <b>Registration pathway:</b> (1) Engage an approved Project Design Document developer, (2) submit to {sizing.carbonStandardData.registry}, (3) undergo validation by an approved Designated Operational Entity, (4) register the project and implement the MRV plan, (5) prepare annual monitoring reports, (6) complete third-party verification every {project.carbonVerificationFrequency} years, (7) receive credit issuance and sell credits.
        </div>
        <div className="alert-box" style={{ marginTop: "1rem", lineHeight: "1.4", border: "1px solid #fca5a5", backgroundColor: "#fef2f2", color: "#7f1d1d" }}>
          Carbon credit revenue should be treated as supplementary income, not the primary justification. Verification timelines of 18-36 months from project start are typical. Carbon prices are volatile. Always confirm additionality with a registered carbon project developer before including credit revenue in binding proposals.
        </div>
        <div style={{ marginTop: "1rem" }}>
          <CheckField
            label="Include carbon revenue in financial model (opt-in)"
            checked={project.carbonInCashflow}
            onChange={(v) => update("carbonInCashflow", v)}
            help="Off by default. Enable only after additionality is confirmed with a carbon developer. Do not enable for standard Kenya grid-tied proposals."
          />
        </div>
      </Card>
    </div>
  );
}

// v11.6 — Solar Borehole & Water Pumping specialist module (water-first).
const BOREHOLE_WARN_TONE = { critical: "danger", warning: "warning", info: "info" };
function SolarBorehole({ project, setProject, borehole, navigateToTab, showToast }) {
  const b = normalizeBorehole(project.borehole);
  const ub = (k, v) => setProject((p) => ({ ...p, borehole: { ...normalizeBorehole(p.borehole), [k]: v } }));
  const [unitCount, setUnitCount] = useState(() => USE_CASE_PRESETS[b.useCase]?.typicalUnits || 1);
  const preset = USE_CASE_PRESETS[b.useCase];
  const res = borehole; // computed results from computeBorehole
  const boq = buildBoreholeBoQ(b, res);
  const prop = summarizeBoreholeForProposal(b, res);
  const applyDemandEstimate = () => {
    const litres = estimateWaterDemand(b.useCase, unitCount);
    ub("dailyWaterDemandLitres", litres);
    if (preset?.pressureAllowanceM != null) ub("pressureAllowanceM", preset.pressureAllowanceM);
    if (showToast) showToast(`Estimated ${litres.toLocaleString()} L/day for ${preset?.label || b.useCase}.`);
  };

  return (
    <div className="vf-page-enter" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <PageHeader
        eyebrow="Specialist module"
        title="Solar Borehole & Water Pumping"
        description="Water-first feasibility sizing: pump, PV, tank and operating hours from water demand, borehole depth and head. Feasibility only — confirm against the borehole test report and pump curve."
        actions={
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "0.85rem" }}>
            <input type="checkbox" checked={!!b.enabled} onChange={(e) => ub("enabled", e.target.checked)} />
            Enable borehole module
          </label>
        }
      />

      {!b.enabled && (
        <WarningPanel tone="info" title="Module off">
          Enable the borehole module to include water pumping in readiness, BoQ and the proposal. You can still explore the inputs below.
        </WarningPanel>
      )}

      <div className="grid-cols-2">
        <Card title="1 · Use case & water demand" subtitle="Water output is the product. Start from litres/day.">
          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-medium)" }}>
              Use case
              <select className="input" value={b.useCase} onChange={(e) => ub("useCase", e.target.value)}>
                {Object.entries(USE_CASE_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <Field label={`Units (${preset?.unit || "unit"})`} type="number" value={unitCount} onChange={(v) => setUnitCount(Math.max(0, v))} />
            <Field label="Daily water demand" type="number" value={b.dailyWaterDemandLitres} onChange={(v) => ub("dailyWaterDemandLitres", Math.max(0, v))} suffix="L/day" />
            <Field label="Desired pumping hours" type="number" value={b.desiredPumpingHoursPerDay} onChange={(v) => ub("desiredPumpingHoursPerDay", clamp(v, 1, 24))} suffix="h/day" />
          </div>
          <button className="btn btn-secondary" style={{ marginTop: "0.6rem" }} onClick={applyDemandEstimate}>Estimate demand from use case →</button>
          {preset?.note && <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "0.4rem" }}>{preset.note}</div>}
        </Card>

        <Card title="2 · Borehole data" subtitle="From the borehole test report where available.">
          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Field label="Tested yield" type="number" value={b.boreholeYieldLitresPerHour} onChange={(v) => ub("boreholeYieldLitresPerHour", Math.max(0, v))} suffix="L/h" />
            <Field label="Static water level" type="number" value={b.staticWaterLevelM} onChange={(v) => ub("staticWaterLevelM", Math.max(0, v))} suffix="m" />
            <Field label="Drawdown" type="number" value={b.drawdownM} onChange={(v) => ub("drawdownM", Math.max(0, v))} suffix="m" />
            <Field label="Dynamic water level" type="number" value={b.dynamicWaterLevelM} onChange={(v) => ub("dynamicWaterLevelM", Math.max(0, v))} suffix="m" />
            <Field label="Pump setting depth" type="number" value={b.pumpSettingDepthM} onChange={(v) => ub("pumpSettingDepthM", Math.max(0, v))} suffix="m" />
          </div>
          <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "0.4rem" }}>Dynamic level defaults to static + drawdown when left at 0.</div>
        </Card>

        <Card title="3 · Pipe, head & tank" subtitle="Drives total dynamic head (TDH).">
          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Field label="Pipe diameter" type="number" value={b.pipeDiameterMm} onChange={(v) => ub("pipeDiameterMm", Math.max(1, v))} suffix="mm" />
            <Field label="Horizontal pipe distance" type="number" value={b.horizontalPipeDistanceM} onChange={(v) => ub("horizontalPipeDistanceM", Math.max(0, v))} suffix="m" />
            <Field label="Tank height" type="number" value={b.tankHeightM} onChange={(v) => ub("tankHeightM", Math.max(0, v))} suffix="m" />
            <Field label="Pressure allowance" type="number" value={b.pressureAllowanceM} onChange={(v) => ub("pressureAllowanceM", Math.max(0, v))} suffix="m" />
            <Field label="Friction loss (0 = auto)" type="number" value={b.frictionLossM} onChange={(v) => ub("frictionLossM", Math.max(0, v))} suffix="m" />
            <Field label="Storage autonomy" type="number" value={b.storageAutonomyDays} onChange={(v) => ub("storageAutonomyDays", clamp(v, 0.5, 7))} suffix="days" />
          </div>
        </Card>

        <Card title="4 · Pump, control & power" subtitle="Conservative feasibility efficiencies.">
          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-medium)" }}>
              Pump type
              <select className="input" value={b.pumpType} onChange={(e) => { const t = e.target.value; ub("pumpType", t); if (PUMP_TYPE_PRESETS[t]) ub("pumpEfficiency", PUMP_TYPE_PRESETS[t].pumpEfficiency); }}>
                {Object.entries(PUMP_TYPE_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-medium)" }}>
              Power mode
              <select className="input" value={b.powerMode} onChange={(e) => ub("powerMode", e.target.value)}>
                {Object.entries(POWER_MODE_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <Field label="Pump efficiency" type="number" value={b.pumpEfficiency} onChange={(v) => ub("pumpEfficiency", clamp(v, 0.1, 0.9))} />
            <Field label="Motor efficiency" type="number" value={b.motorEfficiency} onChange={(v) => ub("motorEfficiency", clamp(v, 0.1, 1))} />
            <Field label="Controller efficiency" type="number" value={b.controllerEfficiency} onChange={(v) => ub("controllerEfficiency", clamp(v, 0.1, 1))} />
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", fontWeight: 600 }}>
              <input type="checkbox" checked={!!b.requiresNightPumping} onChange={(e) => ub("requiresNightPumping", e.target.checked)} /> Night pumping required
            </label>
          </div>
          <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "0.4rem" }}>{POWER_MODE_PRESETS[b.powerMode]?.note}</div>
        </Card>
      </div>

      <Card title="5 · Protection & safety" subtitle="Recommended for reliable, safe borehole systems.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem 1.5rem" }}>
          {[["dryRunProtectionIncluded", "Dry-run protection"], ["floatSwitchIncluded", "Tank float switch"], ["spdIncluded", "Lightning / SPD"], ["earthingIncluded", "Earthing kit"], ["controllerIncluded", "Pump controller / VFD"]].map(([k, label]) => (
            <label key={k} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem", fontWeight: 600 }}>
              <input type="checkbox" checked={!!b[k]} onChange={(e) => ub(k, e.target.checked)} /> {label}
            </label>
          ))}
        </div>
      </Card>

      <Card title="6 · Pump curve & borehole test report" subtitle="Feasibility evidence. Final pump selection requires the pump curve and borehole test confirmation.">
        {(() => {
          const opv = validateBoreholeOperatingPoint(b, res);
          const parseCurve = (txt) => txt.split(/\n/).map((ln) => ln.split(/[,\t]/).map((x) => Number(x.trim()))).filter((a) => a.length >= 2 && Number.isFinite(a[0]) && Number.isFinite(a[1])).map(([flowLph, headM]) => ({ flowLph, headM }));
          const curveText = (b.pumpCurvePoints || []).map((p) => `${p.flowLph}, ${p.headM}`).join("\n");
          const op = b.selectedOperatingPoint || {};
          return (
            <>
              <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <Field label="Test report reference" value={b.testReportRef} onChange={(v) => ub("testReportRef", v)} />
                <Field label="Test duration" type="number" value={b.testDurationHours} onChange={(v) => ub("testDurationHours", Math.max(0, v))} suffix="h" />
                <Field label="Pump model" value={b.pumpModel} onChange={(v) => ub("pumpModel", v)} />
                <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-medium)" }}>Validation status
                  <select className="input" value={b.validationStatus} onChange={(e) => ub("validationStatus", e.target.value)}>
                    {["unvalidated", "provisional", "confirmed"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <Field label="Operating point — flow" type="number" value={op.flowLph ?? ""} onChange={(v) => ub("selectedOperatingPoint", { ...op, flowLph: v })} suffix="L/h" />
                <Field label="Operating point — head" type="number" value={op.headM ?? ""} onChange={(v) => ub("selectedOperatingPoint", { ...op, headM: v })} suffix="m" />
              </div>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-medium)", marginTop: "0.6rem" }}>Pump curve points (one per line: flow_L/h, head_m)</label>
              <textarea className="input" rows={3} placeholder={"3000, 80\n4000, 60\n5000, 40"} defaultValue={curveText}
                onBlur={(e) => ub("pumpCurvePoints", parseCurve(e.target.value))} style={{ resize: "vertical", marginTop: "0.2rem" }} />
              <WarningPanel tone={opv.ok === false ? "danger" : opv.ok === true ? "success" : "info"} title="Pump selection status">
                {opv.message}
              </WarningPanel>
            </>
          );
        })()}
      </Card>

      <Card title="7 · Results" subtitle="Feasibility outputs — confirm on site before final design.">
        <CardGrid min={190}>
          <Metric label="Daily water demand" value={`${Math.round(res.dailyWaterDemandLitres).toLocaleString()} L`} />
          <Metric label="Required flow" value={`${Math.round(res.requiredFlowLitresPerHour).toLocaleString()} L/h`} danger={res.yield?.sufficient === false} />
          <Metric label="Borehole yield status" value={res.yield?.sufficient === false ? "Insufficient" : res.yield?.sufficient === null ? "Unknown" : "OK"} danger={res.yield?.sufficient === false} good={res.yield?.sufficient === true} />
          <Metric label="Total dynamic head" value={`${num(res.totalDynamicHeadM, 0)} m`} hint={`Friction ${num(res.frictionLossM, 1)} m`} />
          <Metric label="Pump electrical" value={`${num(res.pumpElectricalKw, 2)} kW`} hint={`~${res.suggestedPumpHp} HP`} />
          <Metric label="Daily pumping energy" value={`${num(res.dailyPumpingKwh, 1)} kWh`} />
          <Metric label="Recommended PV" value={`${num(res.recommendedPvKwp, 2)} kWp`} hint={`${res.estimatedPanels} panels${res.pvIsPowerLimited ? " · power-limited" : ""}`} />
          <Metric label="Recommended tank" value={`${Math.round(res.recommendedTankLitres).toLocaleString()} L`} hint={`${b.storageAutonomyDays}-day autonomy`} />
          <Metric label="Pumping hours" value={`${num(res.pumpingHoursPerDay, 1)} h`} hint={`Solar window ~${num(res.runtime?.solarWindow, 1)} h`} danger={res.runtime?.exceedsSolarWindow} />
        </CardGrid>
        <div style={{ marginTop: "0.75rem", padding: "0.6rem 0.85rem", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "0.5rem", fontSize: "0.8rem", color: "#1e3a8a", lineHeight: 1.5 }}>
          💧 For boreholes, water storage is usually the best battery. Prefer daytime solar pumping into an elevated tank unless night pumping is genuinely required.
        </div>
      </Card>

      {(res.warnings || []).length > 0 && (
        <Card title="8 · Warnings & confirmations" subtitle="Resolve criticals before quoting.">
          {res.warnings.map((w, i) => <SimBadge key={i} level={w.level === "critical" ? "danger" : w.level === "warning" ? "warning" : "info"}>{w.message}</SimBadge>)}
        </Card>
      )}

      <div className="grid-cols-2">
        <Card title="9 · BoQ preview" subtitle="Editable in the main BoQ. Costs are conservative placeholders.">
          <ResponsiveTable>
            <table className="table">
              <thead><tr><th>Item</th><th style={{ textAlign: "right" }}>Qty</th><th>Unit</th><th style={{ textAlign: "right" }}>Total (KES)</th></tr></thead>
              <tbody>
                {boq.rows.map((r, i) => (
                  <tr key={i}><td>{r.item}</td><td style={{ textAlign: "right" }}>{r.qty}</td><td>{r.unit}</td><td style={{ textAlign: "right" }}>{money(r.total)}</td></tr>
                ))}
                <tr style={{ fontWeight: 800 }}><td colSpan={3}>Borehole subtotal (reference)</td><td style={{ textAlign: "right" }}>{money(boq.total)}</td></tr>
              </tbody>
            </table>
          </ResponsiveTable>
        </Card>
        <Card title="10 · Proposal summary" subtitle="Client-facing outcome.">
          <div style={{ fontSize: "0.85rem", lineHeight: 1.6 }}>
            <p style={{ marginTop: 0 }}>{prop.headline}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem 1.25rem", fontWeight: 600 }}>
              <span>Use case: {prop.useCase}</span>
              <span>Pump: ~{prop.suggestedPumpHp} HP</span>
              <span>PV: {prop.recommendedPvKwp} kWp</span>
              <span>Tank: {Math.round(prop.recommendedTankLitres).toLocaleString()} L</span>
              <span>Strategy: {prop.pumpingStrategy}</span>
            </div>
            {prop.reviewRequired && <div style={{ marginTop: "0.5rem", color: "#b91c1c", fontWeight: 700 }}>⚠ Engineering review required — critical items unresolved.</div>}
          </div>
        </Card>
      </div>

      <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
        Voltflow Internal Alpha — feasibility/pre-design only. Not certified hydraulic engineering. Final pump selection must be confirmed against the actual borehole test report, pump curve, water level, yield and pipe route.
      </div>
    </div>
  );
}

// ── v11.7 Voltflow Studio ────────────────────────────────────────────────────
const STUDIO_STATUS_LABEL = { complete: "Complete", needs_review: "Needs review", incomplete: "In progress", in_progress: "In progress", not_started: "Not started" };

function StudioBlockCard({ block, onClick }) {
  return (
    <button className="vf-studio-block" data-status={block.status} onClick={onClick} title={block.actionLabel}>
      <div className="vf-studio-block-head">
        <span className="vf-studio-block-icon">{block.icon}</span>
        <span style={{ display: "flex", gap: "0.25rem" }}>
          {block.warningCount > 0 && <span className="vf-studio-badge warn">{block.warningCount} ⚠</span>}
          {block.missingCount > 0 && <span className="vf-studio-badge miss">{block.missingCount}</span>}
        </span>
      </div>
      <div className="vf-studio-block-label">{block.label}</div>
      {block.metric && <div className="vf-studio-block-metric">{block.metric}</div>}
      <div className="vf-studio-block-sub">{STUDIO_STATUS_LABEL[block.status] || block.status}</div>
    </button>
  );
}

function ScenarioCard({ scenario, opt, confidence, selected, onUse, onExplain }) {
  return (
    <div className={`vf-scenario-card ${selected ? "selected" : ""}`}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="vf-scenario-name">{scenario.icon} {scenario.name}</span>
        <StatusPill tone={scenario.id === "best" ? "info" : scenario.id === "good" ? "neutral" : "success"}>{scenario.tag}</StatusPill>
      </div>
      <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", lineHeight: 1.4 }}>{scenario.desc}</div>
      <div className="vf-scenario-metrics">
        <span>PV</span><strong>{num(opt.actualKwp, 1)} kWp ({opt.panels}p)</strong>
        <span>Inverter</span><strong>{num(opt.invKw, 1)} kW</strong>
        <span>Battery</span><strong>{num(opt.battKwh, 1)} kWh</strong>
        <span>Cost</span><strong>{money(opt.totalCost)}</strong>
        <span>Payback</span><strong>{Number.isFinite(opt.payback) ? `${num(opt.payback, 1)} yr` : "—"}</strong>
        <span>Confidence</span><strong>{confidence}/100</strong>
      </div>
      <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.2rem", flexWrap: "wrap" }}>
        <button className="btn btn-primary" style={{ padding: "0.3rem 0.7rem", fontSize: "0.78rem" }} onClick={onUse}>Use this design</button>
        {onExplain && <ExplainButton onClick={() => onExplain("dcAcRatio")} />}
      </div>
    </div>
  );
}

function VoltflowStudio({ project, sizing, readiness, blocks, derivedLoads, navigateToTab, openExplain, onApplyTemplate, onApplyScenario, viewMode }) {
  const progress = studioProgressPct(blocks);
  const isEngineer = viewMode === "engineer";
  const templates = listTemplates();
  return (
    <div className="vf-page-enter" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <PageHeader eyebrow="Voltflow Studio" title="Build your solar project"
        description="Your visual command centre. Pick a template, compare Good/Better/Best designs, and click any block to work on it. Every number has an “Explain” for the client conversation."
        actions={<div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}><ReadinessRing score={readiness.overallScore} size={64} label="ready" /><div style={{ fontSize: "0.8rem", color: "var(--text-medium)" }}>Studio progress<br /><strong style={{ fontSize: "1.1rem", color: "var(--text-main)" }}>{progress}%</strong></div></div>} />

      <Card title="Project blocks" subtitle="Client → Delivery. Click a block to jump straight to it; a coloured edge shows its status.">
        <div className="vf-studio-grid">
          {blocks.map((b) => (
            <StudioBlockCard key={b.key} block={b}
              onClick={() => navigateToTab(b.actionTab, { source: "studio", highlightId: b.highlightId, toast: `Opened ${b.label}.` })} />
          ))}
        </div>
      </Card>

      <Card title="Compare solutions" subtitle="Deterministic Good / Better / Best presets sized by the same engine. “Use this design” applies it; nothing is hidden.">
        <div className="vf-card-grid">
          {SCENARIOS.map((s) => {
            const sp = buildScenarioProject(project, s.id);
            const opt = computeOptionSizing(sp, derivedLoads);
            const conf = scenarioConfidence({ batteryKwh: opt.battKwh, dcAcAnalysis: { ratio: (opt.actualKwp || 0) / Math.max(opt.invKw || 1, 1) } }, readiness);
            return <ScenarioCard key={s.id} scenario={s} opt={opt} confidence={conf} selected={project.selectedScenarioId === s.id} onUse={() => onApplyScenario(s.id)} onExplain={openExplain} />;
          })}
        </div>
        <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>Backup expectation for the current design: {backupExpectation(sizing)}. Advisory only — verify every number and get qualified review.</div>
      </Card>

      <Card title="Explain the numbers" subtitle="Open a plain-language + formula explanation for any output — ready to show a client.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          {[["pvSize", "PV size"], ["panelCount", "Panels"], ["inverterSize", "Inverter"], ["dcAcRatio", "DC:AC ratio"], ["batterySize", "Battery"], ["autonomy", "Autonomy"], ["nightAutonomy", "Night autonomy"],
            ...(project.borehole?.enabled ? [["boreholePump", "Borehole pump"], ["boreholePv", "Borehole PV"], ["tankStorage", "Tank storage"]] : []),
            ["totalCost", "Total cost"], ["payback", "Payback"], ["readinessScore", "Readiness"]].map(([key, label]) => (
            <button key={key} className="vf-explain-btn" onClick={() => openExplain(key)}>ⓘ {label}</button>
          ))}
        </div>
      </Card>

      {isEngineer && (
        <Card title="Start from a template" subtitle="Job-type starting points: typical loads, common warnings, proposal language and BoQ categories preloaded. You can edit everything after.">
          <div className="vf-card-grid">
            {templates.map((t) => (
              <div key={t.id} className="vf-tpl-card">
                <span className="vf-tpl-icon">{t.icon}</span>
                <span className="vf-tpl-name">{t.name}</span>
                <span className="vf-tpl-desc">{t.description}</span>
                <div style={{ display: "flex", gap: "0.35rem", alignItems: "center", flexWrap: "wrap" }}>
                  <StatusPill tone="neutral">{t.category}</StatusPill>
                  {t.enableBorehole && <StatusPill tone="info">💧 borehole</StatusPill>}
                </div>
                <button className="btn btn-accent" style={{ padding: "0.3rem 0.7rem", fontSize: "0.78rem", marginTop: "0.2rem" }} onClick={() => onApplyTemplate(t.id)}>Use template</button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isEngineer && (
        <ActionBar>
          <button className="btn btn-secondary" onClick={() => navigateToTab("proposal", { source: "studio" })}>📄 Proposal Studio</button>
          <button className="btn btn-secondary" onClick={() => navigateToTab("assets-lib", { source: "studio" })}>🧰 Asset Library</button>
          <button className="btn btn-secondary" onClick={() => navigateToTab("field-dashboard", { source: "studio" })}>📊 Dashboard</button>
        </ActionBar>
      )}
      <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Voltflow Internal Alpha — feasibility & workflow studio. Calculations are deterministic; AI only explains/drafts. Not certified engineering approval.</div>
    </div>
  );
}

// v11.7.1 — Bank Pilot Mode: a simple guided lead → quote flow for bank staff.
// Reuses existing deterministic sizing + scenarios; hides all engineering detail.
function BankPilotFlow({ project, setProject, sizing, derivedLoads, readiness, navigateToTab, onApplyScenario, showToast }) {
  const up = (k, v) => setProject((p) => ({ ...p, [k]: v }));
  const hasClient = !!(project.client || "").trim();
  const hasSite = !!(project.location || "").trim();
  const hasLoads = (derivedLoads || []).length > 0 && (Number(sizing.dailyKwh) || 0) > 0;
  const hasPackage = !!project.selectedScenarioId;
  const submitted = !!project.bankPilotSubmitted;
  const pilotSafetyAcknowledged = !!project.pilotSafetyAcknowledged;
  const loadBlocked = !!sizing.loadInventoryBlocked || !!sizing.loadInventoryPending || !!sizing.loadInventoryInvalid;
  const blockedText = sizing.quoteBlockedReason || LOAD_PENDING_LABEL;
  const steps = [
    { done: hasClient, label: "1 · Start bank lead — client name" },
    { done: hasSite, label: "2 · Site location" },
    { done: hasLoads, label: "3 · Basic load/bill info" },
    { done: hasPackage, label: "4 · Choose a standard package" },
    { done: hasPackage && hasLoads, label: "5 · Review the quote" },
    { done: submitted, label: "6 · Mark ready locally" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const submit = () => {
    if (!pilotSafetyAcknowledged) {
      showToast("Confirm the pilot data rules before marking ready locally.", "error");
      return;
    }
    if (!hasPackage) {
      showToast("Choose a standard package before marking ready locally.", "error");
      return;
    }
    setProject((p) => ({ ...p, bankPilotSubmitted: true, bankPilotSubmittedAt: new Date().toISOString() }));
    recordAudit(AUDIT_EVENT_TYPES.STAGE_CHANGED, "Marked ready locally for Solarise review (bank pilot)", { user: project.preparedBy });
    showToast("Marked ready locally. Export/share for Solarise review when requested.");
  };
  return (
    <div className="vf-page-enter" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <PageHeader eyebrow="Bank pilot" title="Bank Lead & Quote"
        description="A simple guided flow: enter the basics, pick a standard package, and mark ready locally for Solarise review. No solar engineering knowledge needed."
        actions={<div style={{ fontSize: "0.8rem", color: "var(--text-medium)", textAlign: "right" }}>Progress<br /><strong style={{ fontSize: "1.1rem", color: "var(--text-main)" }}>{pct}%</strong></div>} />

      <WarningPanel tone="warning" title="Controlled pilot — please read">
        This is a <strong>controlled bank-pilot build</strong>. Projects are stored locally in this browser, cloud storage is not configured, and view modes are not access control.
        <strong> Use test or non-sensitive customer data only</strong> until authentication and tenant isolation are enabled.
        <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginTop: "0.65rem", fontWeight: 800 }}>
          <input type="checkbox" checked={pilotSafetyAcknowledged} onChange={(e) => up("pilotSafetyAcknowledged", e.target.checked)} style={{ marginTop: "0.15rem" }} />
          <span>I understand the pilot data rules and have not entered IDs, account numbers, or confidential bank records.</span>
        </label>
      </WarningPanel>

      <Card title="Your progress" subtitle="Complete each step; Solarise finishes the engineering.">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.84rem", color: s.done ? "var(--text-main)" : "var(--text-muted)" }}>
              <span>{s.done ? "✅" : "⬜"}</span> {s.label}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Step 1–3 · Lead & site basics" subtitle="Only the essentials — Solarise completes the engineering.">
        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Client / lead name" value={project.client} onChange={(v) => up("client", v)} />
          <Field label="Site location" value={project.location} onChange={(v) => up("location", v)} />
          <Field label="Approx. monthly electricity bill" type="number" value={project.monthlyBill} onChange={(v) => up("monthlyBill", Math.max(0, v))} suffix="KES" />
          <Field label="Prepared by (your name)" value={project.preparedBy} onChange={(v) => up("preparedBy", v)} />
        </div>
        {!hasLoads && <div style={{ fontSize: "0.78rem", color: "#b45309", marginTop: "0.5rem" }}>Tip: pick a standard package below — it preloads typical loads. Solarise will confirm the details.</div>}
      </Card>

      <Card title="Step 4 · Choose a standard package" subtitle="Good / Better / Best — pick one; you can change it.">
        <div className="vf-card-grid">
          {SCENARIOS.filter((s) => s.id !== "custom").map((s) => {
            const sp = buildScenarioProject(project, s.id);
            const opt = computeOptionSizing(sp, derivedLoads);
            const conf = scenarioConfidence({ batteryKwh: opt.battKwh, dcAcAnalysis: { ratio: (opt.actualKwp || 0) / Math.max(opt.invKw || 1, 1) } }, readiness);
            return <ScenarioCard key={s.id} scenario={s} opt={opt} confidence={conf} selected={project.selectedScenarioId === s.id} onUse={() => onApplyScenario(s.id)} onExplain={null} />;
          })}
        </div>
      </Card>

      <Card title="Step 5 · Quote summary" subtitle="Indicative — Solarise confirms the final design and price.">
        <CardGrid min={150}>
          <Metric label="Recommended system" value={loadBlocked ? blockedText : `${num(sizing.actualKwp, 1)} kWp`} hint={loadBlocked ? "Solarise must confirm loads first." : `${sizing.panels || 0} panels`} />
          <Metric label="Inverter" value={loadBlocked ? blockedText : `${num(sizing.inverterKw, 1)} kW`} />
          <Metric label="Battery" value={loadBlocked ? blockedText : `${num(sizing.batteryKwh, 1)} kWh`} />
          <Metric label="Indicative investment" value={loadBlocked ? blockedText : money(sizing.totalCost)} />
          <Metric label="Est. payback" value={loadBlocked ? blockedText : Number.isFinite(sizing.payback) ? `${num(sizing.payback, 1)} yrs` : "—"} />
          <Metric label="Quote status" value={submitted ? "Ready locally" : "Draft"} good={submitted} />
        </CardGrid>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
          <button className="btn btn-primary" onClick={() => navigateToTab("proposal", { source: "bank" })}>📄 Generate proposal</button>
          <button className="btn btn-accent" onClick={submit} disabled={submitted || !hasPackage || !pilotSafetyAcknowledged}>{submitted ? "✓ Ready locally" : "Mark ready locally"}</button>
        </div>
        <div style={{ fontSize: "0.78rem", color: "var(--text-medium)", marginTop: "0.6rem" }}>
          <strong>Next action:</strong> {submitted ? "Ready locally only - Solarise has not received this automatically. Export/share for Solarise review when requested." : !pilotSafetyAcknowledged ? "Confirm the pilot data rules, then mark ready locally." : hasPackage ? "Generate the proposal, then mark ready locally or export/share for Solarise review." : "Choose a standard package above."}
        </div>
      </Card>

      <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
        Voltflow Internal Alpha / Controlled Bank Pilot Build. Figures are indicative and require Solarise engineering review — not a certified design or final price.
      </div>
    </div>
  );
}

// v11.7 — Asset Library (reusable component catalogue foundation)
function AssetLibraryTab({ project, setProject, sizing, showToast }) {
  const [cat, setCat] = useState("panels");
  const [catalogFilter, setCatalogFilter] = useState("ALL_ASSETS");
  const selections = normalizeAssetSelections(project.assetSelections);
  const inventoryLinks = project.inventoryLinks || {};
  const setSel = (next) => setProject((p) => ({ ...p, assetSelections: normalizeAssetSelections(next) }));
  const add = (assetId) => { const a = getAsset(assetId); setSel([...selections, createAssetSelection(assetId, { qty: 1 })]); if (showToast) showToast(`Added ${a ? a.brand + " " + a.model : assetId}.`); };
  const remove = (i) => setSel(selections.filter((_, idx) => idx !== i));
  const togglePreferred = (i) => setSel(selections.map((s, idx) => (idx === i ? { ...s, preferred: !s.preferred } : s)));
  return (
    <div className="vf-page-enter" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <PageHeader eyebrow="Asset library" title="Solar component catalogue"
        description="Match documented hardware to your design, or browse representative assets. Generic entries are examples; prices and stock require supplier confirmation." />
      <EquipmentMatchingPanel project={project} setProject={setProject} sizing={sizing} />
      <Card title="Browse assets">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem" }}>
          {ASSET_CATEGORIES.map((c) => (
            <button key={c.key} className={`btn ${cat === c.key ? "btn-primary" : "btn-secondary"}`} style={{ padding: "0.28rem 0.7rem", fontSize: "0.78rem" }} onClick={() => setCat(c.key)}>{c.icon} {c.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem" }}>
          {[
            ["TECHNICAL_CATALOG", "Technical catalog"],
            ["AVAILABLE_INVENTORY", "Available inventory"],
            ["ALL_ASSETS", "All assets"],
          ].map(([value, label]) => (
            <button key={value} className={`btn ${catalogFilter === value ? "btn-primary" : "btn-secondary"}`} style={{ padding: "0.25rem 0.65rem", fontSize: "0.76rem" }} onClick={() => setCatalogFilter(value)}>{label}</button>
          ))}
        </div>
        <ResponsiveTable>
          <table className="table">
            <thead><tr><th>Model</th><th>Capacity</th><th>Commercial state</th><th style={{ textAlign: "right" }}>Reference price (KES)</th><th>Warranty</th><th></th></tr></thead>
            <tbody>
              {listAssets(cat, catalogFilter, inventoryLinks).map((a) => {
                const warn = assetCompatibilityWarning(a, project);
                const availability = getCommercialAvailability(a, inventoryLinks[a.id]);
                return (
                  <tr key={a.id}>
                    <td className="font-bold">{a.brand} {a.model}{warn && <div style={{ fontSize: "0.72rem", color: "#b45309" }}>⚠ {warn}</div>}</td>
                    <td>{a.capacity}</td>
                    <td><StatusPill tone={availability.state === "AVAILABLE" ? "success" : availability.state === "LOW_STOCK" ? "warning" : "neutral"}>{availability.state.replace(/_/g, " ")}</StatusPill><div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.2rem", maxWidth: "220px" }}>{availability.message}</div></td>
                    <td style={{ textAlign: "right" }}>{a.price == null ? "Not priced" : money(a.price)}</td>
                    <td>{a.warranty}</td>
                    <td style={{ textAlign: "right" }}><button className="btn btn-accent" style={{ padding: "0.2rem 0.6rem", fontSize: "0.75rem" }} onClick={() => add(a.id)}>Add</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ResponsiveTable>
      </Card>
      <Card title={`Additional catalogue notes (${selections.length})`} subtitle="Matching selections above drive sizing. This optional list is saved for procurement notes only; Add and Prefer do not change the design.">
        {selections.length === 0 ? <EmptyState icon="🧰" title="No additional catalogue notes" description="Add components from the catalogue above if you need extra procurement notes." /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {selections.map((s, i) => {
              const availability = getCommercialAvailability(getAsset(s.assetId) || {}, inventoryLinks[s.assetId]);
              return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0", borderBottom: "1px solid var(--border-medium)", fontSize: "0.83rem" }}>
                <span>{s.preferred ? "⭐ " : ""}<strong>{s.label}</strong> <span style={{ color: "var(--text-muted)" }}>× {s.qty} · {s.category}</span><div style={{ color: availability.state === "AVAILABLE" ? "#047857" : "#b45309", fontSize: "0.7rem" }}>{availability.state.replace(/_/g, " ")} · {availability.message}</div></span>
                <span style={{ display: "flex", gap: "0.35rem" }}>
                  <button className="btn btn-secondary" style={{ padding: "0.18rem 0.55rem", fontSize: "0.72rem" }} onClick={() => togglePreferred(i)}>{s.preferred ? "Unprefer" : "Prefer"}</button>
                  <button className="btn btn-secondary" style={{ padding: "0.18rem 0.55rem", fontSize: "0.72rem" }} onClick={() => remove(i)}>Remove</button>
                </span>
              </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// v11.7 — Proposal Studio: choose + reorder proposal sections and pick a mode.
function ProposalStudioPanel({ project, setProject }) {
  const cfg = normalizeProposalStudioConfig(project.proposalStudioConfig);
  const update = (next) => setProject((p) => ({ ...p, proposalStudioConfig: next }));
  return (
    <Card title="📄 Proposal Studio" subtitle="Choose the audience and pick/reorder the sections. Saved with the project; the report generator honours this structure.">
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem" }}>
        {PROPOSAL_STUDIO_MODES.map((m) => (
          <button key={m.id} className={`btn ${cfg.mode === m.id ? "btn-primary" : "btn-secondary"}`} style={{ padding: "0.28rem 0.7rem", fontSize: "0.78rem" }} onClick={() => update(setProposalMode(cfg, m.id))}>{m.label}</button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {cfg.sections.map((s, i) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", padding: "0.3rem 0.5rem", background: s.enabled ? "var(--bg-card)" : "var(--bg-main, #f8fafc)", border: "1px solid var(--border-medium)", borderRadius: "0.4rem", opacity: s.enabled ? 1 : 0.6 }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.83rem", fontWeight: 600, cursor: "pointer" }}>
              <input type="checkbox" checked={s.enabled} onChange={() => update(toggleSection(cfg, s.id))} /> {s.label}
            </label>
            <span style={{ display: "flex", gap: "0.2rem" }}>
              <button className="btn btn-secondary" style={{ padding: "0.1rem 0.5rem" }} disabled={i === 0} onClick={() => update(reorderSection(cfg, s.id, "up"))}>↑</button>
              <button className="btn btn-secondary" style={{ padding: "0.1rem 0.5rem" }} disabled={i === cfg.sections.length - 1} onClick={() => update(reorderSection(cfg, s.id, "down"))}>↓</button>
            </span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>Enabled sections (in order): {enabledSectionIds(cfg).length}. This composes the proposal; the feasibility disclaimer always remains.</div>
    </Card>
  );
}

// v11.7 — Kenya-first compliance workspace (workflow aid, not certified compliance).
const COMPLIANCE_STATUS_LABEL = { pending: "Pending", in_progress: "In progress", done: "Done", not_applicable: "N/A", flagged: "Flagged" };
function ComplianceWorkspace({ project, setProject }) {
  const c = normalizeCompliance(project.compliance);
  const sum = summarizeCompliance(c);
  const setItem = (sectionKey, itemKey, value) => setProject((p) => {
    const nc = normalizeCompliance(p.compliance);
    nc.sections[sectionKey][itemKey] = value;
    nc.updatedAt = new Date().toISOString();
    return { ...p, compliance: nc };
  });
  const setNotes = (sectionKey, value) => setProject((p) => {
    const nc = normalizeCompliance(p.compliance);
    nc.sections[sectionKey].notes = value;
    return { ...p, compliance: nc };
  });
  return (
    <div className="vf-page-enter" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <PageHeader eyebrow="Compliance workspace" title="Regulatory readiness (Kenya-first)"
        description="Track EPRA, net-metering, NEMA, county/fire, data protection, procurement, e-waste and water-permit readiness. A workflow aid — it does not grant approvals or certify compliance."
        actions={<StatusPill tone={sum.score >= 80 ? "success" : sum.score >= 40 ? "warning" : "neutral"}>{sum.done}/{sum.applicable} done · {sum.score}%</StatusPill>} />
      {sum.flagged > 0 && <WarningPanel tone="warning" title={`${sum.flagged} item(s) flagged`}>Review flagged items before issuing a final quotation.</WarningPanel>}
      {COMPLIANCE_TEMPLATE.map((s) => (
        <Card key={s.key} title={s.label}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {s.items.map((it) => (
              <div key={it.key} style={{ display: "flex", gap: "0.6rem", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.84rem", color: "var(--text-main)", flex: 1, minWidth: "220px" }}>{it.label}</span>
                <select className="input" style={{ maxWidth: "150px" }} value={c.sections[s.key][it.key]} onChange={(e) => setItem(s.key, it.key, e.target.value)}>
                  {COMPLIANCE_STATUSES.map((st) => <option key={st} value={st}>{COMPLIANCE_STATUS_LABEL[st]}</option>)}
                </select>
              </div>
            ))}
            <textarea className="input" rows={2} placeholder="Notes (references, permit numbers, responsible person)…" value={c.sections[s.key].notes} onChange={(e) => setNotes(s.key, e.target.value)} style={{ marginTop: "0.3rem", resize: "vertical" }} />
          </div>
        </Card>
      ))}
      <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Voltflow Internal Alpha — regulatory tracking aid only. Confirm all requirements with the relevant Kenyan authorities (EPRA, NEMA, WRA, county, ODPC) and a qualified professional.</div>
    </div>
  );
}

// v11.7 — Evidence record + pilot KPIs + local audit trail.
function EvidenceWorkspace({ project, setProject, showToast }) {
  const ev = normalizeEvidence(project.evidence);
  const pilot = normalizePilotEvidence(project.pilotEvidence);
  const [log, setLog] = React.useState(() => loadAuditLog());
  const refreshLog = () => setLog(loadAuditLog());
  const setEv = (k, v) => setProject((p) => ({ ...p, evidence: { ...normalizeEvidence(p.evidence), [k]: v, updatedAt: new Date().toISOString() } }));
  const setPilot = (k, v) => setProject((p) => ({ ...p, pilotEvidence: { ...normalizePilotEvidence(p.pilotEvidence), [k]: v } }));
  return (
    <div className="vf-page-enter" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <PageHeader eyebrow="Project evidence" title="Evidence record & pilot outcomes"
        description="A cloud-ready evidence record (who, confidence, version, approval) plus measurable pilot KPIs and a local activity log. Structure is cloud-ready; storage stays in this browser for now." />

      <div className="grid-cols-2">
        <Card title="Evidence record" subtitle="Auditability of who prepared this and how confident it is.">
          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-medium)" }}>Approval status
              <select className="input" value={ev.approvalStatus} onChange={(e) => setEv("approvalStatus", e.target.value)}>{APPROVAL_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-medium)" }}>Confidence level
              <select className="input" value={ev.confidenceLevel} onChange={(e) => setEv("confidenceLevel", e.target.value)}>{CONFIDENCE_LEVELS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            </label>
            <Field label="Responsible person" value={ev.responsibleUser} onChange={(v) => setEv("responsibleUser", v)} />
            <Metric label="Record version" value={`v${ev.version}`} hint={ev.reportFromVersion ? `report from v${ev.reportFromVersion}` : "no report yet"} />
          </div>
          <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "0.4rem" }}>Input source: {ev.inputSource} · last updated {ev.updatedAt ? formatAuditTime(ev.updatedAt) : "—"}.</div>
        </Card>

        <Card title="Pilot evidence (KPIs)" subtitle="Measurable outcomes for market testing. Some need field monitoring.">
          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Field label="Survey→design (min)" type="number" value={pilot.surveyToDesignMinutes ?? ""} onChange={(v) => setPilot("surveyToDesignMinutes", v)} />
            <Field label="Proposal prep (min)" type="number" value={pilot.proposalPrepMinutes ?? ""} onChange={(v) => setPilot("proposalPrepMinutes", v)} />
            <Field label="Errors prevented" type="number" value={pilot.errorsPrevented ?? 0} onChange={(v) => setPilot("errorsPrevented", v)} />
            <Field label="Est. savings (KES)" type="number" value={pilot.savingsKes ?? ""} onChange={(v) => setPilot("savingsKes", v)} />
            <Field label="Avoided fuel (KES)" type="number" value={pilot.avoidedFuelKes ?? ""} onChange={(v) => setPilot("avoidedFuelKes", v)} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.5rem" }}>
            <SimBadge level="info">Actual vs modelled: monitoring required</SimBadge>
            <SimBadge level="info">Uptime: monitoring required</SimBadge>
            <SimBadge level="info">Maintenance response: monitoring required</SimBadge>
          </div>
          <textarea className="input" rows={2} placeholder="User outcome notes…" value={pilot.outcomeNotes} onChange={(e) => setPilot("outcomeNotes", e.target.value)} style={{ marginTop: "0.5rem", resize: "vertical" }} />
        </Card>
      </div>

      <Card title="Activity / audit log" subtitle="Local record of key project events (this browser)."
        actions={<><button className="btn btn-secondary" onClick={refreshLog} style={{ padding: "0.3rem 0.7rem" }}>Refresh</button> <button className="btn btn-secondary" onClick={() => { clearAuditLog(); refreshLog(); showToast && showToast("Audit log cleared for this browser."); }} style={{ padding: "0.3rem 0.7rem" }}>Clear</button></>}>
        {log.length === 0 ? <EmptyState icon="🧾" title="No events recorded yet" description="Applying loads, generating reports, importing/exporting and stage changes are logged here." /> : (
          <div style={{ maxHeight: "320px", overflowY: "auto" }}>
            {log.slice(0, 200).map((e) => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", padding: "0.4rem 0", borderBottom: "1px solid var(--border-medium)", fontSize: "0.8rem" }}>
                <span><strong>{e.label}</strong>{e.detail ? ` — ${e.detail}` : ""}</span>
                <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{formatAuditTime(e.at)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function PilotOperationsPanel({ project, setProject, cloudEnabled }) {
  const [incidentDraft, setIncidentDraft] = useState("");
  const incidents = Array.isArray(project.pilotIncidents) ? project.pilotIncidents : [];
  const openIncidents = incidents.filter((incident) => incident.status !== "closed").length;
  const addIncident = () => {
    const summary = incidentDraft.trim();
    if (summary.length < 3) return;
    const incident = {
      id: crypto.randomUUID(),
      summary,
      status: "open",
      recordedAt: new Date().toISOString(),
    };
    setProject((current) => ({
      ...current,
      pilotIncidents: [incident, ...(Array.isArray(current.pilotIncidents) ? current.pilotIncidents : [])].slice(0, 50),
    }));
    setIncidentDraft("");
  };
  const closeIncident = (id) => setProject((current) => ({
    ...current,
    pilotIncidents: (Array.isArray(current.pilotIncidents) ? current.pilotIncidents : []).map((incident) => (
      incident.id === id
        ? { ...incident, status: "closed", closedAt: new Date().toISOString() }
        : incident
    )),
  }));

  return (
    <Card title="Pilot operations" subtitle="Controls and status for controlled testing. This is not a production monitoring console.">
      <FormGrid min={220}>
        <Metric label="Environment" value={cloudEnabled ? "Connected staging adapter" : "Internal demo"} />
        <Metric label="Backup status" value={cloudEnabled ? "Not verified in app" : "Manual JSON export only"} danger />
        <Metric label="Health monitoring" value="Not configured" danger />
        <Metric label="Open incidents" value={openIncidents} danger={openIncidents > 0} good={openIncidents === 0} />
      </FormGrid>
      <WarningPanel tone="info" title="Operational limits">
        {cloudEnabled
          ? "Confirm Supabase backups, alerting and access-revocation procedures outside this app before a controlled pilot."
          : "Browser data is not a backup. Export from Save / Load before clearing data or changing devices. No cloud submission occurs."}
      </WarningPanel>
      <label style={{ display: "flex", gap: "0.55rem", alignItems: "flex-start", margin: "0.8rem 0", fontSize: "0.82rem", lineHeight: 1.5 }}>
        <input
          type="checkbox"
          checked={!!project.pilotSafetyAcknowledged}
          onChange={(event) => setProject((current) => ({ ...current, pilotSafetyAcknowledged: event.target.checked }))}
        />
        I acknowledge the pilot data scope: use dummy or approved non-sensitive data until connected security proof passes.
      </label>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "end", flexWrap: "wrap" }}>
        <label className="field-group" style={{ flex: "1 1 280px" }}>
          <span className="field-label">Record a basic incident</span>
          <input className="field-input" value={incidentDraft} onChange={(event) => setIncidentDraft(event.target.value)} placeholder="Short description; do not include confidential data" />
        </label>
        <button className="btn btn-secondary" type="button" disabled={incidentDraft.trim().length < 3} onClick={addIncident}>Add incident</button>
      </div>
      {incidents.length > 0 && (
        <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.35rem" }}>
          {incidents.map((incident) => (
            <div key={incident.id} style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", padding: "0.45rem 0", borderBottom: "1px solid var(--border-medium)", fontSize: "0.8rem" }}>
              <span><strong>{incident.status === "closed" ? "Closed" : "Open"}</strong> - {incident.summary}</span>
              {incident.status !== "closed" && <button className="btn btn-secondary" type="button" onClick={() => closeIncident(incident.id)}>Close</button>}
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: "0.7rem", fontSize: "0.74rem", color: "var(--text-muted)" }}>
        Project export and archive/delete controls are under Save / Load. Signing out ends the session; organisation membership revocation remains a manager/backend action.
      </div>
    </Card>
  );
}

function CloudEvidenceAuditWorkspace({ platform, organisationId, projectId, actorRole, roofFaces = [], showToast }) {
  const canHandleEvidence = ["manager", "engineer", "technician"].includes(actorRole);
  const canReviewEvidence = actorRole === "manager" || actorRole === "engineer";
  const [evidence, setEvidence] = useState([]);
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState(false);
  const [photoType, setPhotoType] = useState("SITE_OVERVIEW");
  const [roofFaceId, setRoofFaceId] = useState("");
  const [caption, setCaption] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lastFailedFile, setLastFailedFile] = useState(null);
  const [thumbnailUrls, setThumbnailUrls] = useState({});
  const refresh = async () => {
    const [nextEvidence, nextEvents] = await Promise.all([
      canHandleEvidence ? platform.evidence.listEvidence({ organisationId, projectId }) : Promise.resolve([]),
      platform.audit.listEvents({ organisationId, projectId }),
    ]);
    setEvidence(nextEvidence || []);
    setEvents(nextEvents || []);
  };
  useEffect(() => {
    let active = true;
    Promise.all([
      canHandleEvidence ? platform.evidence.listEvidence({ organisationId, projectId }) : Promise.resolve([]),
      platform.audit.listEvents({ organisationId, projectId }),
    ]).then(([nextEvidence, nextEvents]) => {
      if (!active) return;
      setEvidence(nextEvidence || []);
      setEvents(nextEvents || []);
    }).catch((error) => { if (active) showToast(`Could not load cloud evidence: ${error?.message || "unknown error"}`, "error"); });
    return () => { active = false; };
  }, [platform, organisationId, projectId, canHandleEvidence]);
  useEffect(() => {
    let active = true;
    const photos = evidence.filter((item) => item.serverReceivedAt && String(item.mimeType || "").startsWith("image/"));
    Promise.all(photos.map(async (item) => {
      try {
        const result = await platform.evidence.createDownloadUrl({ organisationId, evidenceId: item.id, expiresInSeconds: 300 });
        return [item.id, result.signedUrl || null];
      } catch {
        return [item.id, null];
      }
    })).then((entries) => {
      if (active) setThumbnailUrls(Object.fromEntries(entries.filter(([, url]) => url)));
    });
    return () => { active = false; };
  }, [platform, organisationId, evidence]);
  const upload = async (file, attempt = 0) => {
    if (!file) return;
    const validationErrors = validatePhotoUpload({
      photoType,
      roofFaceId: photoType === "ROOF" ? roofFaceId : null,
      mimeType: file.type,
      sizeBytes: file.size,
    });
    if (validationErrors.length > 0) {
      showToast(`Photo rejected: ${validationErrors.map((error) => error.code.replace(/_/g, " ").toLowerCase()).join(", ")}.`, "error");
      return;
    }
    setBusy(true);
    setUploadProgress(0);
    try {
      const checksumSha256 = await checksumEvidenceFile(file);
      setUploadProgress(5);
      const prepared = await platform.evidence.prepareUpload({
        organisationId,
        projectId,
        kind: "site_photo",
        photoType,
        roofFaceId: photoType === "ROOF" ? roofFaceId || null : null,
        caption: caption.trim() || null,
        title: file.name,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        checksumSha256,
        deviceCapturedAt: new Date(file.lastModified || Date.now()).toISOString(),
        requestId: crypto.randomUUID(),
      });
      await platform.evidence.uploadPreparedFile({
        storagePath: prepared.storagePath,
        signedToken: prepared.signedToken,
        file,
        checksumSha256,
        onProgress: setUploadProgress,
      });
      await platform.evidence.completeUpload({
        organisationId,
        evidenceId: prepared.evidenceId,
        checksumSha256,
        sizeBytes: file.size,
        requestId: crypto.randomUUID(),
      });
      await refresh();
      setUploadProgress(100);
      setLastFailedFile(null);
      setCaption("");
      showToast(platform.mode === "local_demo" ? "Photo metadata saved locally. No cloud upload occurred." : "Photo uploaded to private project storage.");
    } catch (error) {
      setLastFailedFile({ file, attempt: attempt + 1 });
      showToast(`Evidence upload failed: ${error?.message || "unknown error"}`, "error");
    } finally {
      setBusy(false);
    }
  };
  const retryUpload = () => {
    if (!lastFailedFile) return;
    const delay = uploadRetryDelay(lastFailedFile.attempt);
    setBusy(true);
    window.setTimeout(() => upload(lastFailedFile.file, lastFailedFile.attempt), delay);
  };
  const review = async (item, status) => {
    setBusy(true);
    try {
      await platform.evidence.reviewEvidence({
        organisationId,
        evidenceId: item.id,
        status,
        reason: status === "rejected" ? "Evidence requires replacement or clarification" : "Evidence checked against project context",
        requestId: crypto.randomUUID(),
      });
      await refresh();
      showToast(`Evidence ${status}.`);
    } catch (error) {
      showToast(`Evidence review failed: ${error?.message || "unknown error"}`, "error");
    } finally {
      setBusy(false);
    }
  };
  const download = async (item) => {
    try {
      const result = await platform.evidence.createDownloadUrl({ organisationId, evidenceId: item.id, expiresInSeconds: 300 });
      if (result.signedUrl) window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      showToast(`Evidence download failed: ${error?.message || "unknown error"}`, "error");
    }
  };
  const removeEvidence = async (item) => {
    setBusy(true);
    try {
      await platform.evidence.deleteEvidence({
        organisationId,
        evidenceId: item.id,
        reason: "Removed from project evidence workspace",
        requestId: crypto.randomUUID(),
      });
      await refresh();
      showToast(platform.mode === "local_demo" ? "Local photo metadata deleted." : "Private photo deleted and audit event recorded.");
    } catch (error) {
      showToast(`Evidence deletion failed: ${error?.message || "unknown error"}`, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="vf-page-enter" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <PageHeader eyebrow="Trust foundation" title="Private evidence & audit ledger"
        description={platform.mode === "local-demo" ? "Local photo metadata for workflow testing. No binary upload or cloud submission occurs." : "Tenant-scoped evidence metadata and append-only server events."} />
      {canHandleEvidence && (
        <Card title="Project evidence" subtitle={platform.mode === "local-demo" ? "Metadata only in this browser; selected photo bytes are not stored." : "Private signed upload; no public evidence URLs."}>
          <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: "0.75rem" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem", fontWeight: 600 }}>Photo type
              <select className="input" value={photoType} onChange={(event) => { setPhotoType(event.target.value); if (event.target.value !== "ROOF") setRoofFaceId(""); }}>
                {PHOTO_TYPES.map((type) => <option key={type} value={type}>{type.replace(/_/g, " ")}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem", fontWeight: 600 }}>Roof face
              <select className="input" value={roofFaceId} disabled={photoType !== "ROOF"} onChange={(event) => setRoofFaceId(event.target.value)}>
                <option value="">Unassigned</option>
                {roofFaces.map((face) => <option key={face.id} value={face.id}>{face.label || face.name || face.id}</option>)}
              </select>
            </label>
            <Field label="Caption" value={caption} onChange={setCaption} placeholder="Optional field note" />
          </div>
          <label className="btn btn-primary" style={{ cursor: busy ? "wait" : "pointer", marginBottom: "0.75rem" }}>
            Upload photo
            <input type="file" disabled={busy} accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={(event) => { upload(event.target.files?.[0]); event.target.value = ""; }} />
          </label>
          {busy && <div style={{ marginBottom: "0.75rem" }}><progress value={uploadProgress} max="100" style={{ width: "100%" }} /><div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{uploadProgress}%</div></div>}
          {lastFailedFile && !busy && <button className="btn btn-secondary" style={{ margin: "0 0 0.75rem 0.5rem" }} onClick={retryUpload}>Retry upload</button>}
          {evidence.length === 0 ? <EmptyState title="No private photos" description="Upload a JPEG, PNG or WebP survey photo." /> : evidence.map((item) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", padding: "0.55rem 0", borderBottom: "1px solid var(--border-light)" }}>
              <div style={{ display: "flex", gap: "0.65rem", alignItems: "center", minWidth: 0 }}>
                {thumbnailUrls[item.id] && <img src={thumbnailUrls[item.id]} alt="" style={{ width: 72, height: 54, objectFit: "cover", borderRadius: 4, border: "1px solid var(--border-light)", flex: "0 0 auto" }} />}
                <div><strong style={{ fontSize: "0.84rem" }}>{item.title}</strong><div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{(item.photoType || item.kind || "evidence").replace(/_/g, " ")} · {item.mimeType} · {Math.round(item.sizeBytes / 1024)} KB · {item.reviewStatus}</div>{item.caption && <div style={{ fontSize: "0.72rem", color: "var(--text-medium)" }}>{item.caption}</div>}</div>
              </div>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                {canReviewEvidence && item.reviewStatus === "submitted" && <button className="btn btn-secondary" disabled={busy} onClick={() => review(item, "verified")}>Verify</button>}
                {canReviewEvidence && item.reviewStatus === "submitted" && <button className="btn btn-secondary" disabled={busy} onClick={() => review(item, "rejected")}>Reject</button>}
                {item.serverReceivedAt && <button className="btn btn-secondary" onClick={() => download(item)}>Download</button>}
                <button className="btn btn-secondary" disabled={busy} onClick={() => removeEvidence(item)}>Delete</button>
              </div>
            </div>
          ))}
        </Card>
      )}
      <Card title="Server audit events" subtitle="Append-only project ledger; ordinary roles cannot clear or edit it."
        actions={<button className="btn btn-secondary" onClick={refresh}>Refresh</button>}>
        {events.length === 0 ? <EmptyState title="No server events" description="Cloud saves, versions, evidence and reviews appear here." /> : events.map((event) => (
          <div key={event.id} style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", padding: "0.45rem 0", borderBottom: "1px solid var(--border-light)", fontSize: "0.8rem" }}>
            <span><strong>{event.action}</strong>{event.reason ? ` · ${event.reason}` : ""}</span>
            <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{formatAuditTime(event.occurred_at || event.created_at)}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function GensetHybrid({ project, setProject, sizing }) {
  const update = (k, v) => setProject((p) => ({ ...p, [k]: v }));
  return (
    <div className="grid-cols-2">
      <Card title="Genset operating costs" subtitle="Current diesel generator baseline before solar displacement.">
        <div className="form-grid">
          <Field label="Fuel Consumption" type="number" value={project.gensetFuelLPerHour} onChange={(v) => update("gensetFuelLPerHour", Math.max(v, 0))} suffix="L/hr" />
          <Field label="Diesel Cost" type="number" value={project.gensetFuelCostKes} onChange={(v) => update("gensetFuelCostKes", Math.max(v, 0))} suffix="KES/L" />
          <Field label="Run Hours / Day" type="number" value={project.gensetRunHoursPerDay} onChange={(v) => update("gensetRunHoursPerDay", clamp(v, 0, 24))} suffix="hrs" />
          <Field label="Annual Maintenance" type="number" value={project.gensetMaintenanceCostYr} onChange={(v) => update("gensetMaintenanceCostYr", Math.max(v, 0))} suffix="KES/yr" />
          <Metric label="Annual Fuel Cost" value={money(sizing.annualFuelCost)} />
          <Metric label="Total Genset Cost" value={money(sizing.annualGensetTotalCost)} />
          <Metric label="Annual Run Hours" value={`${num(sizing.annualGensetHours, 0)} hrs`} />
          <Metric label="Fuel Consumption" value={`${num(sizing.annualFuelLitres, 0)} L/yr`} />
        </div>
      </Card>
      <Card title="Solar displacement" subtitle="Solar reduces genset runtime and service burden.">
        <div className="form-grid">
          <Metric label="Displacement Fraction" value={pct(sizing.solarGensetDisplacementFraction)} good={sizing.solarGensetDisplacementFraction > 0.5} />
          <Metric label="New Run Hours" value={`${num(sizing.newGensetRunHours, 1)} hrs/day`} danger={sizing.newGensetRunHours < 2} />
          <Metric label="Annual Fuel Saved" value={money(sizing.annualFuelSaved)} />
          <Metric label="Maintenance Saved" value={money(sizing.annualMaintenanceSaved)} />
          <Metric label="Total Genset Savings" value={money(sizing.annualGensetSavings)} />
          <Metric label="Remaining Life" value={`${num(sizing.gensetRemainingLife, 1)} yrs`} />
        </div>
      </Card>
      <Card title="Altitude derating" subtitle="Use available kVA, not nameplate kVA, at high-altitude sites.">
        <div className="form-grid">
          <Field label="Rated Genset Capacity" type="number" value={project.gensetRatedKva} onChange={(v) => update("gensetRatedKva", Math.max(v, 0))} suffix="kVA" />
          <Field disabled={!!project.equipmentSelection?.enabled} label="Site Altitude" type="number" value={project.altitude} onChange={(v) => update("altitude", Math.max(v, 0))} suffix="m" />
          <Metric label="Derating" value={pct(sizing.gensetDeratePct)} danger={sizing.gensetDeratePct > 0.02} />
          <Metric label="Available Capacity" value={`${num(sizing.gensetAvailableKva, 2)} kVA`} />
        </div>
      </Card>
      <Card title="Combined economics" subtitle="KPLC savings plus diesel displacement benefits.">
        <div className="form-grid">
          <Field label="Genset Age" type="number" value={project.gensetAgeYears} onChange={(v) => update("gensetAgeYears", clamp(v, 0, 40))} suffix="yrs" />
          <Field label="Expected Life" type="number" value={project.gensetLifeYears} onChange={(v) => update("gensetLifeYears", clamp(v, 1, 40))} suffix="yrs" />
          <Metric label="KPLC Savings" value={money(sizing.annualSavings)} />
          <Metric label="Genset Savings" value={money(sizing.annualGensetSavings)} />
          <Metric label="Total Annual Benefit" value={money(sizing.totalAnnualBenefit)} good={sizing.totalAnnualBenefit > sizing.annualSavings} />
          <Metric label="Revised Payback" value={`${num(sizing.gensetHybridPayback, 2)} yrs`} />
          <Metric label="Replacement Avoided" value={money(sizing.gensetReplacementCostAvoided)} hint="Indicative if remaining life is under 5 years" />
        </div>
      </Card>
    </div>
  );
}

function EVCharging({ project, setProject, sizing }) {
  const update = (k, v) => setProject((p) => ({ ...p, [k]: v }));
  const specOptions = Object.entries(evChargerSpecs).map(([value, data]) => ({ value, label: data.label }));
  return (
    <div className="grid-cols-2">
      <Card title="Charger specification" subtitle="Select charger class and bay count.">
        <div className="form-grid">
          <SelectField label="Charger Type" value={project.evChargerType} onChange={(v) => update("evChargerType", v)} options={specOptions} />
          <Field label="Total Bays" type="number" value={project.evChargersTotal} onChange={(v) => update("evChargersTotal", Math.max(1, Math.floor(v)))} />
          <Field label="Peak Simultaneous" type="number" value={project.evPeakSimultaneous} onChange={(v) => update("evPeakSimultaneous", clamp(Math.floor(v), 1, project.evChargersTotal))} />
          <Field label="Daily Charging Hours" type="number" value={project.evDailyChargingHours} onChange={(v) => update("evDailyChargingHours", clamp(v, 0, 24))} suffix="hrs" />
          <Metric label="Charger Rating" value={`${num(sizing.evChargerKw, 1)} kW`} />
          <Metric label="Standard" value={sizing.evSpec.standard} />
        </div>
        <div className="carbon-info" style={{ marginTop: "1rem" }}>
          {sizing.evSpec.notes}
        </div>
      </Card>
      <Card title="Load and demand" subtitle="Demand check uses 80% grid utilisation rule.">
        <div className="form-grid">
          <Field label="Occupancy" type="number" value={project.evOccupancy} onChange={(v) => update("evOccupancy", clamp(v, 0, 1))} suffix="0-1" />
          <Field label="Grid Connection" type="number" value={project.evGridConnectionKva} onChange={(v) => update("evGridConnectionKva", Math.max(v, 0))} suffix="kVA" />
          <Metric label="Peak Demand" value={`${num(sizing.evPeakDemandKw, 1)} kW`} danger={!sizing.gridConnectionAdequate} />
          <Metric label="Connected Load" value={`${num(sizing.evTotalConnectedKw, 1)} kW`} />
          <Metric label="Daily Energy" value={`${num(sizing.evDailyEnergyKwh, 1)} kWh/day`} />
          <Metric label="Annual Energy" value={`${num(sizing.evAnnualEnergyKwh, 0)} kWh/yr`} />
          <Metric label="Grid Adequate" value={sizing.gridConnectionAdequate ? "Yes" : "No"} good={sizing.gridConnectionAdequate} danger={!sizing.gridConnectionAdequate} />
        </div>
      </Card>
      <Card title="Revenue model" subtitle="Gross margin before charger finance, rent and operations.">
        <div className="form-grid">
          <Field label="EV Selling Tariff" type="number" value={project.evTariffKes} onChange={(v) => update("evTariffKes", Math.max(v, 0))} suffix="KES/kWh" />
          <Metric label="Annual EV Revenue" value={money(sizing.annualEVRevenue)} />
          <Metric label="Annual Grid Cost" value={money(sizing.annualGridCostEV)} />
          <Metric label="Annual Gross Profit" value={money(sizing.annualEVProfit)} good={sizing.annualEVProfit > 0} danger={sizing.annualEVProfit < 0} />
          <Metric label="Revenue / kWh" value={`${num(project.evTariffKes, 2)} KES`} />
          <Metric label="Margin / kWh" value={`${num(project.evTariffKes - project.gridTariff, 2)} KES`} good={project.evTariffKes > project.gridTariff} danger={project.evTariffKes <= project.gridTariff} />
        </div>
      </Card>
      <Card title="Infrastructure requirements" subtitle="Fast charging requires stronger upstream infrastructure.">
        <div className="form-grid">
          <Metric label="Transformer Required" value={sizing.transformerRequired ? "Likely" : "Not likely"} danger={sizing.transformerRequired} />
          <Metric label="OCPP Required" value={sizing.ocppRequired ? "Yes" : "Optional"} good={sizing.ocppRequired} />
        </div>
        <div className="carbon-info" style={{ marginTop: "1rem" }}>
          For DCFC and above: contact KPLC distribution engineering for a dedicated MV connection. Standard LV supply at 230/415V is insufficient above 100 kW total site demand.
        </div>
      </Card>
      <Card title="Battery buffer for EV peak shaving (optional)" subtitle="Add battery to smooth peak EV demand and reduce grid connection requirement.">
        <div className="form-grid">
          <CheckField label="Enable EV battery buffer" checked={project.evBatteryBufferEnabled ?? false} onChange={(v) => update("evBatteryBufferEnabled", v)} help="Sizes battery to buffer EV peak demand rather than minimum backup only." />
          {project.evBatteryBufferEnabled && <>
            <Field label="Buffer hours" type="number" value={project.evPeakBufferHours ?? 1} onChange={(v) => update("evPeakBufferHours", clamp(v, 0.5, 8))} suffix="hrs" help="Nominal EV peak demand buffer window." />
            <Metric label="EV peak demand" value={`${num(sizing.evPeakDemandKw, 1)} kW`} />
            <Metric label="EV buffer battery required" value={`${num(sizing.evBatteryBufferKwh, 1)} kWh`} hint="Before DoD/efficiency" />
            <Metric label="Battery bank sized to" value={`${num(sizing.batteryKwh, 1)} kWh`} hint={`${sizing.batteryModules} modules`} />
          </>}
        </div>
        <div className="carbon-info" style={{ marginTop: "0.75rem" }}>
          EV buffer is advisory. Many EV sites use grid-only chargers without battery storage. Enable only if peak shaving is a specific site requirement.
        </div>
      </Card>
    </div>
  );
}

function MiniGrid({ project, setProject, sizing }) {
  const update = (k, v) => setProject((p) => ({ ...p, [k]: v }));
  return (
    <div className="grid-cols-2">
      <Card title="Community load" subtitle="Set subscriber demand and match the Load Assessment daily load to this value.">
        <div className="form-grid">
          <Field label="Households" type="number" value={project.mgHouseholds} onChange={(v) => update("mgHouseholds", Math.max(0, Math.floor(v)))} />
          <Field label="Commercial Customers" type="number" value={project.mgCommercialCustomers} onChange={(v) => update("mgCommercialCustomers", Math.max(0, Math.floor(v)))} />
          <Field label="Anchor Load" type="number" value={project.mgAnchorLoad} onChange={(v) => update("mgAnchorLoad", Math.max(v, 0))} suffix="kW" />
          <Field label="Household Load" type="number" value={project.mgHouseholdLoadKwh} onChange={(v) => update("mgHouseholdLoadKwh", Math.max(v, 0))} suffix="kWh/day" />
          <Field label="Commercial Load" type="number" value={project.mgCommercialLoadKwh} onChange={(v) => update("mgCommercialLoadKwh", Math.max(v, 0))} suffix="kWh/day" />
          <Metric label="Community Daily Load" value={`${num(sizing.communityDailyKwh, 1)} kWh/day`} />
        </div>
      </Card>
      <Card title="Revenue model" subtitle="Household, commercial and anchor tariffs.">
        <div className="form-grid">
          <Field label="Residential Tariff" type="number" value={project.mgResidentialTariff} onChange={(v) => update("mgResidentialTariff", Math.max(v, 0))} suffix="KES/kWh" />
          <Field label="Commercial Tariff" type="number" value={project.mgCommercialTariff} onChange={(v) => update("mgCommercialTariff", Math.max(v, 0))} suffix="KES/kWh" />
          <Field label="Anchor Tariff" type="number" value={project.mgAnchorTariff} onChange={(v) => update("mgAnchorTariff", Math.max(v, 0))} suffix="KES/kWh" />
          <Metric label="Residential Revenue" value={money(sizing.annualResidentialRevenue)} />
          <Metric label="Commercial Revenue" value={money(sizing.annualCommercialRevenue)} />
          <Metric label="Anchor Revenue" value={money(sizing.annualAnchorRevenue)} />
          <Metric label="Total Annual Revenue" value={money(sizing.totalAnnualRevenue)} />
        </div>
      </Card>
      <Card title="Economics" subtitle="Generation plus distribution capex viability.">
        <div className="form-grid">
          <Field label="Distribution Capex" type="number" value={project.mgCapexDistribution} onChange={(v) => update("mgCapexDistribution", Math.max(v, 0))} suffix="KES" />
          <Field label="Opex / Subscriber" type="number" value={project.mgOpexPerSubscriberYr} onChange={(v) => update("mgOpexPerSubscriberYr", Math.max(v, 0))} suffix="KES/yr" />
          <Metric label="Annual EBITDA" value={money(sizing.annualEBITDA)} good={sizing.annualEBITDA > 0} danger={sizing.annualEBITDA < 0} />
          <Metric label="Break-even Tariff" value={`${num(sizing.breakEvenTariff, 2)} KES/kWh`} />
          <Metric label="Residential Viable" value={sizing.residentialTariffViable ? "Yes" : "No"} good={sizing.residentialTariffViable} danger={!sizing.residentialTariffViable} />
          <Metric label="Mini-grid Payback" value={`${num(sizing.miniGridPayback, 2)} yrs`} />
          <Metric label="Revenue Multiple" value={`${num(sizing.revenueMultipleOnCost, 2)}x`} hint="Capex / EBITDA" />
        </div>
      </Card>
      <Card title="Subsidy gap" subtitle="Viability gap for grant or concessional finance applications.">
        <Metric label="Gap / Household / Year" value={money(sizing.subsidyGapPerHousehold)} danger={sizing.subsidyGapPerHousehold > 0} good={sizing.subsidyGapPerHousehold === 0} />
        <div className="carbon-info" style={{ marginTop: "1rem" }}>
          This figure represents the viability gap that could be covered by REA/REREC subsidies or DFI concessional finance under the Kenya Off-Grid Solar Access Project (KOSAP).
        </div>
      </Card>
      <Card title="Subscriber economics" subtitle="Connection fee, capex intensity and revenue per user." style={{ gridColumn: "1 / -1" }}>
        <div className="form-grid">
          <Field label="Connection Fee" type="number" value={project.mgConnectionFee} onChange={(v) => update("mgConnectionFee", Math.max(v, 0))} suffix="KES" />
          <Metric label="Subscribers" value={num(sizing.totalSubscribers, 0)} />
          <Metric label="Capex / Subscriber" value={money(sizing.capexPerSubscriber)} />
          <Metric label="Revenue / Subscriber" value={money(sizing.revenuePerSubscriberYr)} hint="per year" />
          <Metric label="Year 1 Connection Revenue" value={money(sizing.annualConnectionRevenue)} />
        </div>
      </Card>
    </div>
  );
}

export function Storage({ project, setProject, loadItemsV2, setLoadItemsV2, loadAssessmentMode, setLoadAssessmentMode, accessoriesAssumptions, setAccessoriesAssumptions, accessoryOverrides, setAccessoryOverrides, accessoriesCatalogue, setAccessoriesCatalogue, projectRef, setProjectRef, copilotHistory, setCopilotHistory, copilotLastReview, setCopilotLastReview, survey, setSurvey, simulation, setSimulation, savedProjects, setSavedProjects, showToast, onProjectActivated, viewMode, platform, activeMembership, cloudEnabled = false, cloudProjectId, cloudRevisionNo, onCloudProjectChanged, onLocalProjectQuarantined }) {
  const [saveName, setSaveName] = useState(project.client || survey.clientName || "Untitled Project");
  const [saveState, setSaveState] = useState({ status: "idle" });
  const saveInFlight = useRef(false);
  const confirmedCloudSave = useRef(null);
  useEffect(() => {
    confirmedCloudSave.current = cloudProjectId ? { id: cloudProjectId, revisionNo: cloudRevisionNo } : null;
  }, [cloudProjectId, cloudRevisionNo]);
  const [pendingImport, setPendingImport] = useState(null); // { record, summary, warnings } — review step before applying (v11.3)
  const canUseProjectJson = canExportProjectBackup(normalizeViewMode(viewMode), { cloudEnabled, role: activeMembership?.role });
  const buildRecord = (extra = {}) => ({
    schemaVersion: SCHEMA_VERSION, appVersion: APP_VERSION, exportedBy: project.preparedBy || "", projectRef, pilotSafety: PILOT_SAFETY_METADATA,
    project, survey, simulation,
    loadAssessmentMode, loadItemsV2, accessoriesAssumptions, accessoryOverrides, accessoriesCatalogue,
    copilotHistory, copilotLastReview,
    // v11.3 — explicit top-level conveniences for humans reading the export
    // (all also live inside `project`; `loads` is the flat legacy shape older
    // builds can still open)
    sizingMode: project.sizingMode,
    energyImportSummary: project.energyImport || null,
    loads: toLegacyLoads(loadItemsV2, loadAssessmentMode),
    ...extra,
  });
  const saveCurrent = async () => {
    if (saveInFlight.current) return;
    const record = buildRecord({ id: Date.now(), name: saveName || project.client || "Untitled Project", savedAt: new Date().toISOString() });
    if (cloudEnabled) {
      saveInFlight.current = true;
      setSaveState({ status: "saving" });
      try {
        const target = confirmedCloudSave.current;
        const result = await saveCloudProjectAndRefresh({
          projects: platform.projects,
          organisationId: activeMembership.organisationId,
          projectId: target?.id || cloudProjectId,
          expectedRevisionNo: target?.revisionNo ?? cloudRevisionNo,
          record, requestId: crypto.randomUUID(),
          onSaved: (saved) => { confirmedCloudSave.current = saved; onCloudProjectChanged?.(saved); },
        });
        if (result.records) setSavedProjects(result.records);
        setSaveState(result.refreshError
          ? { status: "refresh-error", message: "Your project was saved successfully. Refreshing the list will not save it again." }
          : { status: "idle" });
        showToast(result.refreshError ? "Project saved; the project list could not refresh." : "Project saved to the organisation workspace.");
      } catch (error) {
        // Input is left untouched so the user can retry or export a backup.
        const conflict = error?.code === "CONFLICT";
        const message = conflict
          ? "This project changed in another session. Reload it before saving."
          : `Cloud save could not be confirmed: ${error?.message || "unknown error"}`;
        setSaveState({ status: "error", conflict, message });
        showToast(message, "error");
      } finally {
        saveInFlight.current = false;
      }
      return;
    }
    const { records, persisted } = saveProjectLocal(record, savedProjects);
    setSavedProjects(records);
    setSaveState(persisted ? { status: "idle" } : { status: "error", conflict: false, message: "Browser storage is full or unavailable — export JSON as a backup." });
    showToast(persisted ? "Project saved locally." : "Saved for this session, but browser storage is full/unavailable — export JSON as a backup.", persisted ? "success" : "error");
  };
  const refreshSavedProjects = async () => {
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setSaveState({ status: "refreshing" });
    try {
      setSavedProjects(await platform.projects.listProjects({ organisationId: activeMembership.organisationId }));
      setSaveState({ status: "idle" });
      showToast("Saved project list refreshed.");
    } catch {
      setSaveState({ status: "refresh-error", message: "The saved project is unchanged. The list is still unavailable; try refreshing it later." });
    } finally {
      saveInFlight.current = false;
    }
  };
  const exportCurrent = () => {
    if (!canUseProjectJson) { showToast("Project JSON is restricted to authorised members in Engineer View.", "error"); return; }
    const { filename, jsonString } = exportProjectJson(buildRecord({ exportedAt: new Date().toISOString() }));
    const blob = new Blob([jsonString], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    recordAudit(AUDIT_EVENT_TYPES.EXPORT_PERFORMED, filename);
  };
  const applyNormalizedRecord = (record) => {
    const norm = normalizeLoadedRecord(record);
    const loadedSaveName = [record?.name, norm.project.client, norm.survey.clientName].find((value) => typeof value === "string" && value.trim());
    setSaveName(loadedSaveName || "Untitled Project");
    setProject(norm.project);
    setSurvey(norm.survey);
    setSimulation(norm.simulation);
    setLoadAssessmentMode(norm.loadAssessmentMode);
    setLoadItemsV2(norm.loadItemsV2);
    setAccessoriesAssumptions(norm.accessoriesAssumptions);
    setAccessoryOverrides(norm.accessoryOverrides);
    setAccessoriesCatalogue(norm.accessoriesCatalogue);
    setProjectRef(norm.projectRef);
    setCopilotHistory(norm.copilotHistory);
    setCopilotLastReview(norm.copilotLastReview);
  };
  const loadProject = (record) => {
    try {
      applyNormalizedRecord(record);
      if (onProjectActivated) onProjectActivated(record);
      showToast(`Loaded: ${record?.name || "project"}`);
    } catch {
      if (!cloudEnabled) {
        quarantineLocalProjectRecord(record, "Saved project could not be normalized during load.");
        setSavedProjects((records) => records.filter((item) => item !== record));
        onLocalProjectQuarantined?.();
      }
      showToast("Could not load this saved project - it was skipped and preserved for recovery.", "error");
    }
  };
  const deleteProject = async (id) => {
    if (cloudEnabled) {
      try {
        const record = savedProjects.find((item) => item.id === id);
        await platform.projects.archiveProject({
          organisationId: activeMembership.organisationId,
          projectId: id,
          expectedRevisionNo: record?.revisionNo,
          requestId: crypto.randomUUID(),
          reason: "Project archived from Voltflow workspace",
        });
        setSavedProjects(await platform.projects.listProjects({ organisationId: activeMembership.organisationId }));
        if (cloudProjectId === id) onCloudProjectChanged?.(null);
        showToast("Project archived in the organisation workspace.");
      } catch (error) {
        showToast(`Could not archive project: ${error?.message || "unknown error"}`, "error");
      }
      return;
    }
    const { records } = deleteProjectLocal(id, savedProjects);
    setSavedProjects(records);
  };
  // v11.3 import safety: validate + summarise first, apply only on confirm
  const importJson = (file) => {
    if (!canUseProjectJson) { showToast("Project JSON is restricted to authorised members in Engineer View.", "error"); return; }
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importProjectJson(String(reader.result), { schemaVersion: SCHEMA_VERSION, appVersion: APP_VERSION });
      if (!result.ok) {
        setPendingImport(null);
        showToast(result.error, "error");
        return;
      }
      setPendingImport(result);
      showToast("File read — review the import summary below, then click Apply.");
    };
    reader.readAsText(file);
  };
  const applyPendingImport = async () => {
    if (!pendingImport) return;
    try {
      if (cloudEnabled) {
        const migration = await prepareLegacyProjectMigration(pendingImport.record, {
          organisationId: activeMembership.organisationId,
        });
        const imported = await platform.projects.importLegacyProject({
          organisationId: activeMembership.organisationId,
          migration,
          requestId: crypto.randomUUID(),
        });
        applyNormalizedRecord(imported);
        onProjectActivated?.(imported);
        onCloudProjectChanged?.(imported);
        setSavedProjects(await platform.projects.listProjects({ organisationId: activeMembership.organisationId }));
        setPendingImport(null);
        showToast("Local export migrated to the organisation workspace with provenance recorded.");
        return;
      }
      applyNormalizedRecord(pendingImport.record);
      if (onProjectActivated) onProjectActivated(pendingImport.record);
      recordAudit(AUDIT_EVENT_TYPES.IMPORT_PERFORMED, pendingImport.record?.project?.client || "project imported");
      setPendingImport(null);
      showToast("Project imported successfully.");
    } catch {
      showToast("Could not apply this file — its data looks corrupted.", "error");
    }
  };
  return (
    <div className="grid-cols-2">
      {/* v11.3 — Phase 1 limitation notice */}
      <div style={{ gridColumn: "1 / -1", background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: "0.6rem", padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#78350f", fontWeight: 600 }}>
        {cloudEnabled ? "Authenticated organisation storage is active. Project writes use revision checks and server audit events." : "Projects are currently saved in this browser only. Engineer View can export/import project JSON for backup or handoff."}
        <span style={{ fontWeight: 400, marginLeft: "0.4rem", color: "#92400e" }}>
          {cloudEnabled ? " Private cloud project storage is enabled for this signed-in tenant." : CLOUD_STORAGE_CONFIGURED ? "Cloud sync is enabled." : "Cloud sync is not yet configured in this Internal Alpha build."}
        </span>
      </div>
      <Card title="Save current project" subtitle={cloudEnabled ? "Authenticated organisation workspace." : "Local browser storage — useful for engineers between sessions."}>
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
          <input aria-label="Project name" className="table-input" style={{ flex: 1, padding: "0.65rem 0.9rem", borderRadius: "var(--radius-md)" }} value={saveName} onChange={(e) => setSaveName(e.target.value)} disabled={["saving", "refreshing"].includes(saveState.status)} />
          <button onClick={saveCurrent} className="btn btn-primary" disabled={["saving", "refreshing"].includes(saveState.status)}>
            {saveState.status === "saving" ? "Saving…" : saveState.status === "refreshing" ? "Refreshing…" : "Save"}
          </button>
        </div>
        <SaveFeedback state={saveState} canExport={canUseProjectJson} onRetry={saveCurrent} onRefresh={refreshSavedProjects} onExport={exportCurrent} />
        <div className="carbon-info">{cloudEnabled ? "Concurrent edits are rejected until the latest revision is reloaded." : "Saved projects remain in this browser until cleared. No cloud submission occurs in local mode."}</div>
      </Card>
      {canUseProjectJson ? (
      <Card title="Import / export" subtitle="JSON export includes project, loads, survey, simulation, sizing mode, energy-import summary, app version and export time.">
        <div className="action-box-spacing">
          <label className="btn btn-secondary btn-full" style={{ borderStyle: "dashed", cursor: "pointer", height: "auto", padding: "1.25rem 1.5rem" }}>
            Import JSON project 📂
            <input type="file" accept="application/json,.json" style={{ display: "none" }} onChange={(e) => { importJson(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <button onClick={exportCurrent} className="btn btn-primary btn-full">
            Export current project JSON 📥
          </button>
        </div>
      </Card>
      ) : (
      <Card title="Import / export" subtitle="Authorised members in Engineer View only.">
        <WarningPanel tone="info" title="Project JSON hidden in this view">
          Full project JSON can include internal costs, blockers, raw engineering notes and metadata. Only authorised members in Engineer View can import or export it.
        </WarningPanel>
      </Card>
      )}
      {/* v11.3 — Phase 4 import review step */}
      {canUseProjectJson && pendingImport && (
        <Card title="Review import before applying" subtitle="Nothing has been changed yet — applying replaces the current working project." style={{ gridColumn: "1 / -1", border: "2px solid #93c5fd" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.5rem", fontSize: "0.82rem", marginBottom: "0.75rem" }}>
            <span><b>Project:</b> {pendingImport.summary.name}</span>
            <span><b>Client:</b> {pendingImport.summary.client}</span>
            <span><b>Location:</b> {pendingImport.summary.location}</span>
            <span><b>System type:</b> {pendingImport.summary.systemType}</span>
            <span><b>App version:</b> {pendingImport.summary.appVersion} (schema {pendingImport.summary.schemaVersion})</span>
            <span><b>Exported:</b> {pendingImport.summary.exportedAt ? new Date(pendingImport.summary.exportedAt).toLocaleString() : "—"} by {pendingImport.summary.exportedBy}</span>
            <span><b>Loads:</b> {pendingImport.summary.loadCount} item(s)</span>
            <span><b>Sizing basis:</b> {pendingImport.summary.sizingMode.replace(/_/g, " ")}</span>
            <span><b>Simulation data:</b> {pendingImport.summary.hasSimulation ? "yes" : "no"}</span>
            <span><b>Energy import data:</b> {pendingImport.summary.hasEnergyImport ? "yes" : "no"}</span>
            <span><b>Pilot safety:</b> {pendingImport.summary.hasPilotSafety ? "declared" : "not declared"}</span>
            <span><b>Storage model:</b> {pendingImport.summary.pilotSafetyStorageModel}</span>
          </div>
          {pendingImport.warnings.map((w, i) => <SimBadge key={i} level="warning">{w}</SimBadge>)}
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem" }}>
            <button onClick={applyPendingImport} className="btn btn-primary">✓ Apply import</button>
            <button onClick={() => setPendingImport(null)} className="btn btn-secondary">✕ Cancel</button>
          </div>
        </Card>
      )}
      {/* v11.4.1 — visible way to clear old demo/startup data from this browser */}
      {!cloudEnabled && <div style={{ gridColumn: "1 / -1" }}>
        <ResetLocalDataPanel showToast={showToast} compact onCleared={() => setSavedProjects([])} />
      </div>}
      <Card title="Saved projects" subtitle={cloudEnabled ? "Load or archive tenant-owned cloud records." : "Load or delete locally saved records."} style={{ gridColumn: "1 / -1" }}>
        <ResponsiveDataTable
          rows={savedProjects}
          getRowKey={(r) => r.id}
          stickyHeader={false}
          emptyState={<EmptyState icon="💾" title="No saved projects yet"
            description={cloudEnabled ? "Projects saved to your organisation workspace appear here when the project list is available." : "Save the current project to keep it in this browser, or import a project JSON file exported from another device."} />}
          columns={[
            { key: "name", label: "Project", bold: true, render: (r) => r.name },
            { key: "client", label: "Client", hideOnMobile: true, render: (r) => r.project?.client || "—" },
            { key: "loads", label: "Loads", align: "right", hideOnMobile: true, render: (r) => (r.loadItemsV2 || []).length || "—" },
            { key: "version", label: "Saved with", hideOnMobile: true, render: (r) => r.appVersion || "—" },
            { key: "savedAt", label: "Saved", render: (r) => (r.savedAt ? new Date(r.savedAt).toLocaleString() : "—") },
            { key: "actions", label: "", align: "right", render: (r) => (
              <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                <button onClick={() => loadProject(r)} className="btn btn-accent" style={{ padding: "0.35rem 0.8rem", fontSize: "0.78rem" }}>Load</button>
                <button onClick={() => deleteProject(r.id)} className="btn btn-secondary" style={{ padding: "0.35rem 0.8rem", fontSize: "0.78rem", color: "var(--color-red)" }}>{cloudEnabled ? "Archive" : "Delete"}</button>
              </div>
            ) },
          ]}
        />
      </Card>
    </div>
  );
}

/* ─── FIELD WORKFLOW COMPONENTS ─────────────────────────────────────────── */

function SurveyField({ label, children }) {
  return (
    <div className="field-group">
      <span className="field-label">{label}</span>
      {children}
    </div>
  );
}

function SurveyInput({ label, value, onChange, type = "text", min, max, step, emptyValue = 0, ...rest }) {
  return (
    <SurveyField label={label}>
      {type === "number" ? (
        <SmartNumberField value={value} onChange={onChange} min={min} max={max} step={step} emptyValue={emptyValue} />
      ) : (
        <input type={type} className="field-input" value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
      )}
    </SurveyField>
  );
}

function SurveySelect({ label, value, onChange, options }) {
  return (
    <SurveyField label={label}>
      <select className="select-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </SurveyField>
  );
}

function SurveyCheck({ label, checked, onChange }) {
  return (
    <label className="check-container" style={{ marginTop: "0.25rem" }}>
      <input type="checkbox" className="check-input" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="check-text-title">{label}</span>
    </label>
  );
}

function MultiCheck({ label, options, selected, onChange }) {
  const toggle = (opt) => {
    const next = selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt];
    onChange(next);
  };
  return (
    <div className="field-group">
      <span className="field-label">{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            style={{
              padding: "5px 12px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              border: selected.includes(opt) ? "1.5px solid var(--color-primary)" : "1.5px solid var(--border-medium)",
              background: selected.includes(opt) ? "#ecfdf5" : "#fff",
              color: selected.includes(opt) ? "#065f46" : "var(--text-secondary)",
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function AlertBox({ type = "warning", children }) {
  const styles = {
    warning: { background: "#fffbeb", border: "1px solid #fcd34d", color: "#78350f" },
    success: { background: "#f0fdf4", border: "1px solid #86efac", color: "#14532d" },
    danger:  { background: "#fef2f2", border: "1px solid #fca5a5", color: "#7f1d1d" },
  };
  return (
    <div style={{ ...styles[type], borderRadius: "10px", padding: "10px 14px", marginBottom: "12px", fontSize: "12.5px" }}>
      {children}
    </div>
  );
}

function FieldDashboard({ survey, setActive }) {
  const steps = [
    { key: "new-project",    label: "Client Info",      done: !!survey.clientName },
    { key: "roof-shading",   label: "Roof Assessment",  done: survey.roofLengthM > 0 && survey.roofWidthM > 0 },
    { key: "electrical",     label: "Electrical",       done: survey.meterNumber !== "" || !survey.kplcActive },
    { key: "loads",          label: "Load Inventory",   done: false },
    { key: "site-photos",    label: "Site Photos",      done: Object.values(survey.photos).some(Boolean) },
    { key: "safety-risks",   label: "Safety Review",    done: false },
  ];
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);

  return (
    <div className="dashboard-wrapper">
      <div className="banner">
        <div className="banner-flex">
          <div>
            <div className="banner-sub">Field Survey Dashboard</div>
            <h1 className="banner-title">{survey.clientName || "No active project"}</h1>
            <p className="banner-desc">
              {survey.siteAddress || "Start a new project to begin the field workflow"}
            </p>
          </div>
          <button onClick={() => setActive("new-project")} className="btn btn-secondary">
            New Project
          </button>
        </div>
      </div>

      <div className="grid-cols-4">
        <Metric label="Survey Progress" value={`${pct}%`} hint={`${done} of ${steps.length} sections`} good={pct === 100} />
        <Metric label="Client" value={survey.clientName || "—"} />
        <Metric label="Site Type" value={survey.siteType || "—"} />
        <Metric label="Monthly Bill" value={survey.monthlyBill ? money(survey.monthlyBill) : "—"} />
      </div>

      <Card title="Survey checklist" subtitle="Complete all sections before generating a proposal.">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {steps.map((s) => (
            <div
              key={s.key}
              style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.65rem 1rem", background: "#fff", border: `1px solid var(--border-medium)`, borderRadius: "8px", cursor: "pointer" }}
              onClick={() => setActive(s.key)}
            >
              <div style={{ width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", flexShrink: 0, background: s.done ? "#dcfce7" : "#f1f5f9", color: s.done ? "#166534" : "#64748b" }}>
                {s.done ? "✓" : "○"}
              </div>
              <div style={{ flex: 1, fontWeight: 500, fontSize: "13px" }}>{s.label}</div>
              <div style={{ fontSize: "11px", fontWeight: 600, color: s.done ? "#10b981" : "#94a3b8" }}>{s.done ? "Done" : "Pending"}</div>
            </div>
          ))}
        </div>
        {pct < 100 && (
          <AlertBox type="warning" style={{ marginTop: "1rem" }}>
            ⚠ Complete all survey sections before submitting the proposal.
          </AlertBox>
        )}
      </Card>
    </div>
  );
}

function NewProject({ survey, setSurvey, setActive }) {
  const set = (k, v) => setSurvey((s) => ({ ...s, [k]: v }));
  const counties = ["Nairobi","Kiambu","Machakos","Mombasa","Kwale","Kilifi","Kisumu","Uasin Gishu","Nakuru","Garissa","Turkana","Marsabit","Kajiado","Murang'a","Nyeri","Meru","Embu","Laikipia","Nyandarua"];
  const siteTypes = ["Residential","Commercial","Industrial","Farm / Agricultural","School","Hospital / Clinic"];
  const objectives = ["Bill reduction","Backup during blackouts","Full off-grid","Hybrid solar","Generator fuel reduction","EV charging readiness","Solar water pumping"];

  return (
    <div className="grid-cols-2">
      <Card title="Client & site details" subtitle="These details will pre-fill the engineering project and proposal.">
        <div className="form-grid">
          <SurveyInput label="Client Name *" value={survey.clientName} onChange={(v) => set("clientName", v)} />
          <SurveyInput label="Phone Number *" value={survey.phone} onChange={(v) => set("phone", v)} />
          <SurveyInput label="Email" type="email" value={survey.email} onChange={(v) => set("email", v)} />
          <SurveyInput label="Site Address *" value={survey.siteAddress} onChange={(v) => set("siteAddress", v)} />
          <SurveySelect label="County" value={survey.county} onChange={(v) => set("county", v)} options={counties} />
          <SurveySelect label="Site Type *" value={survey.siteType} onChange={(v) => set("siteType", v)} options={siteTypes} />
          <SurveyInput label="Survey Date" type="date" value={survey.surveyDate} onChange={(v) => set("surveyDate", v)} />
          <SurveyInput label="Surveyor Name" value={survey.surveyor} onChange={(v) => set("surveyor", v)} />
        </div>
      </Card>
      <Card title="Objectives & notes" subtitle="Client objectives guide system design recommendations.">
        <MultiCheck
          label="Client Objectives"
          options={objectives}
          selected={survey.clientObjectives}
          onChange={(v) => set("clientObjectives", v)}
        />
        <div className="field-group" style={{ marginTop: "1rem" }}>
          <span className="field-label">Site Notes</span>
          <textarea
            className="field-input"
            style={{ minHeight: "80px", resize: "vertical" }}
            value={survey.siteNotes}
            onChange={(e) => set("siteNotes", e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={() => setActive("site-survey")}>
            Start Site Survey →
          </button>
          <button className="btn btn-secondary" onClick={() => setActive("field-dashboard")}>
            Back to Dashboard
          </button>
        </div>
      </Card>
    </div>
  );
}

function SiteSurvey({ survey, setSurvey, setActive }) {
  const set = (k, v) => setSurvey((s) => ({ ...s, [k]: v }));
  const weather = ["Sunny", "Partly cloudy", "Overcast", "Rainy"];
  const steps = [
    { label: "Client Info",     done: !!survey.clientName },
    { label: "Roof Assessment", done: survey.roofLengthM > 0 },
    { label: "Electrical",      done: !!survey.meterNumber || !survey.kplcActive },
    { label: "Load Inventory",  done: false },
    { label: "Site Photos",     done: Object.values(survey.photos).some(Boolean) },
    { label: "Safety Review",   done: false },
  ];
  const done = steps.filter((s) => s.done).length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "1rem" }}>
      <Card title="Survey Progress" subtitle="">
        <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--color-primary)" }}>
          {Math.round((done / steps.length) * 100)}%
        </div>
        <div style={{ background: "#f1f5f9", borderRadius: "20px", height: "8px", margin: "8px 0 12px" }}>
          <div style={{ background: "var(--color-primary)", borderRadius: "20px", height: "100%", width: `${Math.round((done / steps.length) * 100)}%` }} />
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "14px" }}>{done} of {steps.length} sections complete</div>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", background: "#fff", border: "1px solid var(--border-medium)", borderRadius: "8px", fontSize: "12px", marginBottom: "6px" }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", flexShrink: 0, background: s.done ? "#dcfce7" : "#f1f5f9", color: s.done ? "#166534" : "#64748b" }}>
              {s.done ? "✓" : i + 1}
            </div>
            <span style={{ flex: 1, fontWeight: 500 }}>{s.label}</span>
            <span style={{ fontSize: "11px", fontWeight: 600, color: s.done ? "#10b981" : "#94a3b8" }}>{s.done ? "Done" : "Pending"}</span>
          </div>
        ))}
        {done < steps.length && (
          <AlertBox type="warning">Cannot finalise proposal until all sections are complete.</AlertBox>
        )}
      </Card>
      <Card title={survey.clientName ? `${survey.clientName} — ${survey.siteAddress}` : "Active Survey"} subtitle="">
        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <SurveyInput label="Site Reference" value={survey.siteRef || ""} onChange={(v) => set("siteRef", v)} />
          <SurveySelect label="Weather at Survey" value={survey.weather || "Sunny"} onChange={(v) => set("weather", v)} options={weather} />
          <SurveyInput label="GPS Coordinates" value={survey.gps || ""} onChange={(v) => set("gps", v)} />
          <SurveyInput label="Survey Team" value={survey.surveyor} onChange={(v) => set("surveyor", v)} />
        </div>
        <div className="field-group" style={{ marginTop: "0.75rem" }}>
          <span className="field-label">Site Notes</span>
          <textarea
            className="field-input"
            style={{ minHeight: "80px", resize: "vertical" }}
            value={survey.siteNotes}
            onChange={(e) => set("siteNotes", e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={() => setActive("roof-shading")}>Roof & Shading →</button>
          <button className="btn btn-secondary" onClick={() => setActive("loads")}>Go to Loads</button>
          <button className="btn btn-secondary" onClick={() => setActive("site-photos")}>Photos</button>
        </div>
      </Card>
    </div>
  );
}

function RoofShading({ survey, setSurvey, setActive }) {
  const set = (k, v) => setSurvey((s) => ({ ...s, [k]: v }));
  const roofTypes  = ["Mabati / Iron sheet", "Concrete slab", "Clay tiles", "Stone-coated tiles", "Ground mount", "Carport", "Asbestos — Do Not Proceed"];
  const conditions = ["Good", "Fair", "Weak", "Rusted", "Needs structural repair"];
  const orientations = ["North", "North-East", "East", "South-East", "South", "South-West", "West", "North-West"];
  const shadingOpts  = ["None", "Trees", "Building", "Water tank", "Chimney", "Power lines"];
  const inputModes   = [
    { value: "manual_dimensions",  label: "Manual dimensions" },
    { value: "gps_coordinates",    label: "GPS corner coordinates" },
    { value: "blueprint_dimensions", label: "Blueprint / drawing dimensions" },
    { value: "satellite_estimate", label: "Satellite estimate (unverified)" },
  ];

  const mode = survey.roofInputMode || "manual_dimensions";

  const calcArea = (len, wid) => {
    const a = +(len * wid * (survey.roofUsablePercent || 0.70)).toFixed(1);
    setSurvey((s) => ({ ...s, roofAreaM2: a }));
  };

  const setGpsCorner = (corner, field, val) =>
    set(corner, { ...(survey[corner] || {}), [field]: parseFloat(val) || "" });

  const isAsbestos = survey.roofType === "Asbestos — Do Not Proceed";
  const noShading  = survey.shadingSources.includes("None");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

      {/* Row 1: Roof type & condition */}
      <div className="grid-cols-2">
        <Card title="Roof type & condition" subtitle="">
          <SurveySelect label="Roof Type" value={survey.roofType} onChange={(v) => set("roofType", v)} options={roofTypes} />
          {isAsbestos && <AlertBox type="danger">⛔ ASBESTOS: Do Not Proceed. Licensed asbestos removal required before any work.</AlertBox>}
          <SurveySelect label="Roof Condition" value={survey.roofCondition} onChange={(v) => set("roofCondition", v)} options={conditions} />
          {(survey.roofCondition === "Weak" || survey.roofCondition === "Rusted" || survey.roofCondition === "Needs structural repair") && (
            <AlertBox type="warning">⚠ Structural assessment required before installation. Include in BoQ notes.</AlertBox>
          )}
        </Card>

        <Card title="Measurement input mode" subtitle="Choose how roof dimensions will be captured.">
          <div className="form-grid">
            {inputModes.map(m => (
              <label key={m.value} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", border: `1.5px solid ${mode === m.value ? "var(--color-primary)" : "var(--border-medium)"}`, borderRadius: "0.5rem", cursor: "pointer", background: mode === m.value ? "#ecfdf5" : "#fff", fontSize: "0.82rem", fontWeight: mode === m.value ? 700 : 400 }}>
                <input type="radio" name="roofInputMode" value={m.value} checked={mode === m.value} onChange={() => set("roofInputMode", m.value)} style={{ accentColor: "var(--color-primary)" }} />
                {m.label}
              </label>
            ))}
          </div>
          {mode === "satellite_estimate" && <AlertBox type="warning">Satellite estimates must be verified on site before use in BoQ or structural design.</AlertBox>}
        </Card>
      </div>

      {/* Row 2: Dimension inputs (mode-dependent) */}
      <div className="grid-cols-2">

        {/* Manual dimensions */}
        {(mode === "manual_dimensions" || mode === "satellite_estimate") && (
          <Card title="Roof measurements" subtitle="">
            <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="field-group">
                <span className="field-label">Roof Length (m)</span>
                <input type="number" className="field-input" value={survey.roofLengthM}
                  onChange={(e) => { const v = Number(e.target.value); set("roofLengthM", v); calcArea(v, survey.roofWidthM); }} />
              </div>
              <div className="field-group">
                <span className="field-label">Roof Width (m)</span>
                <input type="number" className="field-input" value={survey.roofWidthM}
                  onChange={(e) => { const v = Number(e.target.value); set("roofWidthM", v); calcArea(survey.roofLengthM, v); }} />
              </div>
              <SurveyInput label="Usable Area (m²)" type="number" value={survey.roofAreaM2} onChange={(v) => set("roofAreaM2", v)} />
              <SurveyInput label="Usable % of gross" type="number" value={Math.round((survey.roofUsablePercent || 0.7) * 100)}
                onChange={(v) => set("roofUsablePercent", clamp(v, 10, 100) / 100)} />
              <SurveyInput label="Pitch Angle (°)" type="number" value={survey.roofPitch} onChange={(v) => set("roofPitch", v)} />
              <SurveyInput label="Azimuth (°)" type="number" value={survey.roofAzimuthDeg || 180} onChange={(v) => set("roofAzimuthDeg", v)} />
              <SurveySelect label="Orientation" value={survey.orientation} onChange={(v) => { set("orientation", v); }} options={orientations} />
            </div>
          </Card>
        )}

        {/* GPS corners */}
        {mode === "gps_coordinates" && (
          <Card title="GPS corner coordinates" subtitle="Enter lat/lng for up to 4 roof corners. At least 3 required for area calculation.">
            {["gpsCornerA", "gpsCornerB", "gpsCornerC", "gpsCornerD"].map((corner, i) => (
              <div key={corner} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.6rem" }}>
                <div className="field-group">
                  <span className="field-label">Corner {String.fromCharCode(65 + i)} — Latitude</span>
                  <input type="number" step="0.000001" className="field-input" placeholder="-1.2921"
                    value={survey[corner]?.lat || ""} onChange={(e) => setGpsCorner(corner, "lat", e.target.value)} />
                </div>
                <div className="field-group">
                  <span className="field-label">Corner {String.fromCharCode(65 + i)} — Longitude</span>
                  <input type="number" step="0.000001" className="field-input" placeholder="36.8219"
                    value={survey[corner]?.lng || ""} onChange={(e) => setGpsCorner(corner, "lng", e.target.value)} />
                </div>
              </div>
            ))}
            <AlertBox type="warning">GPS measurements are approximate (±1–3 m). Verify physically before final BoQ.</AlertBox>
          </Card>
        )}

        {/* Blueprint dimensions */}
        {mode === "blueprint_dimensions" && (
          <Card title="Blueprint / drawing dimensions" subtitle="">
            <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <SurveyInput label="Blueprint Length (m)" type="number" value={survey.blueprintRoofLengthM || 0} onChange={(v) => set("blueprintRoofLengthM", v)} />
              <SurveyInput label="Blueprint Width (m)" type="number" value={survey.blueprintRoofWidthM || 0} onChange={(v) => set("blueprintRoofWidthM", v)} />
              <SurveyInput label="Scale factor" type="number" value={survey.blueprintScaleFactor || 1} onChange={(v) => set("blueprintScaleFactor", v)} />
              <SurveyInput label="Obstruction allowance (%)" type="number" value={Math.round((survey.blueprintObstructionPct ?? 0.15) * 100)}
                onChange={(v) => set("blueprintObstructionPct", clamp(v, 0, 50) / 100)} />
              <SurveyInput label="Pitch (°)" type="number" value={survey.blueprintPitchDeg || 15} onChange={(v) => set("blueprintPitchDeg", v)} />
              <SurveyInput label="Orientation (°)" type="number" value={survey.blueprintOrientationDeg || 180} onChange={(v) => set("blueprintOrientationDeg", v)} />
            </div>
            <AlertBox type="info" style={{ marginTop: "0.5rem" }}>Blueprint dimensions are indicative until confirmed on site.</AlertBox>
          </Card>
        )}

        {/* Shading */}
        <Card title="Shading sources" subtitle="">
          <MultiCheck label="Shading Sources" options={shadingOpts} selected={survey.shadingSources} onChange={(v) => set("shadingSources", v)} />
          {noShading
            ? <AlertBox type="success">✓ No shading. {(survey.orientation || "").includes("South") ? "South-facing — excellent for Kenya." : "Check orientation."}</AlertBox>
            : survey.shadingSources.length > 0 && !noShading && <AlertBox type="warning">⚠ Shading detected. Consider MPPT optimisers or alternative roof face.</AlertBox>}
          <SurveyInput label="Pitch Angle (°)" type="number" value={survey.roofPitch} onChange={(v) => set("roofPitch", v)} />
        </Card>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={() => setActive("roof-layout")}>Roof Layout →</button>
        <button className="btn btn-primary" onClick={() => setActive("electrical")}>Electrical Assessment →</button>
        <button className="btn btn-secondary" onClick={() => setActive("site-survey")}>← Site Survey</button>
      </div>
    </div>
  );
}

/* ─── ROOF LAYOUT TAB ─────────────────────────────────────────────────────── */

function AlertBoxInline({ level = "info", children }) {
  const s = {
    info:    { bg: "#eff6ff", border: "#93c5fd", color: "#1e40af" },
    warning: { bg: "#fffbeb", border: "#fcd34d", color: "#78350f" },
    danger:  { bg: "#fef2f2", border: "#fca5a5", color: "#7f1d1d" },
    success: { bg: "#f0fdf4", border: "#86efac", color: "#14532d" },
  }[level] || {};
  return (
    <div style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color, borderRadius: "8px", padding: "8px 12px", marginBottom: "8px", fontSize: "12.5px" }}>
      {children}
    </div>
  );
}

function RoofLayoutTab({ survey, setSurvey, project, setProject, sizing, roofGeometry, panelLayout, tiltGuidance, rowSpacing, installerTips, roofWarnings, blueprintAdvice }) {
  const upd = (k, v) => setProject(p => ({ ...p, [k]: v }));
  const fitColour = panelLayout.roofFitStatus?.startsWith("Fits comfortably") ? "#10b981"
    : panelLayout.roofFitStatus?.startsWith("Fits with") ? "#f59e0b"
    : panelLayout.roofFitStatus?.startsWith("Does not") ? "#ef4444"
    : "#64748b";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

      {/* Critical warnings */}
      {roofWarnings.length > 0 && (
        <div>
          {roofWarnings.map((w, i) => (
            <AlertBoxInline key={i} level={w.level}>{w.level === "danger" ? "⛔" : w.level === "warning" ? "⚠" : "ℹ"} {w.msg}</AlertBoxInline>
          ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid-cols-4">
        <Metric label="Usable Roof Area" value={`${(roofGeometry.roofAreaUsableM2 || 0).toFixed(1)} m²`} hint={`Gross: ${(roofGeometry.roofAreaGrossM2 || 0).toFixed(1)} m²`} />
        <Metric label="Panels Required" value={`${sizing.panels || 0}`} hint={`${project.panelW}W each`} />
        <Metric label="Panels That Fit" value={`${panelLayout.estimatedPanelsThatFit || "—"}`} hint={panelLayout.recommendedPanelOrientation} />
        <Metric label="Roof Fit" value={panelLayout.roofFitStatus?.split("—")[0]?.trim() || "—"}
          good={panelLayout.roofFitStatus?.startsWith("Fits comfortably")}
          danger={panelLayout.roofFitStatus?.startsWith("Does not")} />
      </div>

      <div className="grid-cols-2">

        {/* Panel layout parameters */}
        <Card title="Panel dimensions & layout" subtitle="Used to estimate how many panels fit on the roof.">
          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Field disabled={!!project.equipmentSelection?.enabled} label="Panel Length (m)" type="number" value={project.panelLengthM} onChange={v => upd("panelLengthM", v)} step="0.01" />
            <Field disabled={!!project.equipmentSelection?.enabled} label="Panel Width (m)"  type="number" value={project.panelWidthM}  onChange={v => upd("panelWidthM", v)}  step="0.01" />
            <Field label="Edge Setback (m)" type="number" value={project.roofEdgeSetbackM} onChange={v => upd("roofEdgeSetbackM", v)} step="0.1" help="Clearance from roof edges" />
            <Field label="Walkway (m)"      type="number" value={project.roofWalkwayAllowanceM} onChange={v => upd("roofWalkwayAllowanceM", v)} step="0.1" help="Maintenance walkway allowance" />
            <SelectField label="Mounting Orientation" value={project.mountingOrientation} onChange={v => upd("mountingOrientation", v)}
              options={[{ value: "auto", label: "Auto (best fit)" }, { value: "portrait", label: "Portrait" }, { value: "landscape", label: "Landscape" }]} />
            <Field label="Usable % of gross" type="number" value={Math.round((project.roofUsablePercent || 0.7) * 100)}
              onChange={v => upd("roofUsablePercent", clamp(v, 10, 100) / 100)} suffix="%" />
          </div>
          <div style={{ background: "#f8fafc", borderRadius: "0.5rem", padding: "0.75rem", marginTop: "0.75rem", fontSize: "0.82rem" }}>
            <div style={{ fontWeight: 700, marginBottom: "0.4rem", color: fitColour }}>
              {panelLayout.roofFitStatus}
            </div>
            <div style={{ color: "#475569" }}>
              Portrait: {panelLayout.maxPanelsPortrait} · Landscape: {panelLayout.maxPanelsLandscape} · Utilisation: {(panelLayout.roofUtilisationPercent || 0).toFixed(0)}%
            </div>
          </div>
        </Card>

        {/* Tilt & orientation guidance */}
        <Card title="Tilt & orientation guidance" subtitle="Kenya-specific planning guidance — not a structural design.">
          <InfoRow label="Recommended Tilt" value={`${tiltGuidance.recommendedTiltDeg}°`} />
          <div style={{ fontSize: "0.82rem", color: "#475569", padding: "0.4rem 0", borderBottom: "1px solid #f1f5f9", marginBottom: "0.4rem" }}>
            {tiltGuidance.tiltReason}
          </div>
          <InfoRow label="Orientation" value={roofGeometry.roofOrientationLabel} />
          <div style={{ fontSize: "0.82rem", color: "#475569", padding: "0.4rem 0", borderBottom: "1px solid #f1f5f9", marginBottom: "0.4rem" }}>
            {tiltGuidance.azimuthComment}
          </div>
          {tiltGuidance.pitchAdjustmentAdvice && (
            <AlertBoxInline level="info">💡 {tiltGuidance.pitchAdjustmentAdvice}</AlertBoxInline>
          )}
          {tiltGuidance.shadingRiskAdvice && (
            <AlertBoxInline level={(survey.shadingSources || []).some(s => s !== "None") ? "warning" : "info"}>
              🌥 {tiltGuidance.shadingRiskAdvice}
            </AlertBoxInline>
          )}
        </Card>

        {/* Row spacing (flat roofs) */}
        {(roofGeometry.roofPitchDeg || survey.roofPitch || 0) < 10 && (
          <Card title="Row spacing advisory" subtitle="For tilt structures and flat/near-flat roofs only.">
            <div className="grid-cols-2" style={{ marginBottom: "0.75rem" }}>
              <Metric label="Panel Shadow Length" value={`${rowSpacing.shadowLengthM} m`} />
              <Metric label="Min Row Spacing" value={`${rowSpacing.approximateRowSpacingM} m`} hint="Centre-to-centre, conservative" />
            </div>
            <AlertBoxInline level="warning">{rowSpacing.rowSpacingWarning}</AlertBoxInline>
          </Card>
        )}

        {/* Roof geometry summary */}
        <Card title="Roof geometry summary" subtitle={`Capture method: ${survey.roofInputMode || "manual"} · Confidence: ${roofGeometry.roofCaptureConfidence}`}>
          <InfoRow label="Gross Area" value={`${(roofGeometry.roofAreaGrossM2 || 0).toFixed(1)} m²`} />
          <InfoRow label="Usable Area" value={`${(roofGeometry.roofAreaUsableM2 || 0).toFixed(1)} m²`} />
          <InfoRow label="Length (estimated)" value={`${(roofGeometry.roofLengthEstimatedM || 0).toFixed(1)} m`} />
          <InfoRow label="Width (estimated)" value={`${(roofGeometry.roofWidthEstimatedM || 0).toFixed(1)} m`} />
          <InfoRow label="Pitch" value={`${(roofGeometry.roofPitchDeg || 0).toFixed(0)}°`} />
          <InfoRow label="Azimuth" value={`${(roofGeometry.roofAzimuthEstimatedDeg || 0).toFixed(0)}° (${roofGeometry.roofOrientationLabel})`} />
          {roofGeometry.roofWarnings?.map((w, i) => (
            <AlertBoxInline key={i} level="info">ℹ {w}</AlertBoxInline>
          ))}
        </Card>
      </div>

      {/* Installer tips */}
      <Card title="Installer technical guidance"
        subtitle={`Generated from ${survey.roofType || "roof type"} and site survey data. For planning reference only — confirm all points on site.`}>
        <ul style={{ paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {installerTips.map((tip, i) => (
            <li key={i} style={{ fontSize: "0.82rem", color: "#374151", lineHeight: 1.5 }}>{tip}</li>
          ))}
        </ul>
        <div style={{ marginTop: "0.75rem", padding: "0.6rem 0.85rem", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: "0.5rem", fontSize: "0.78rem", color: "#78350f" }}>
          ⚠ Installer guidance is for planning reference only. Final roof structural assessment, wind loading, waterproofing, earthing, and safe-work methods must be verified on site by qualified personnel.
        </div>
      </Card>

      {/* Blueprint / new-build construction advice */}
      {blueprintAdvice.length > 0 && (
        <Card title="Blueprint / New-Build Construction Advice"
          subtitle="Reserve solar provisions during construction — much cheaper than retrofitting.">
          <ul style={{ paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {blueprintAdvice.map((tip, i) => (
              <li key={i} style={{ fontSize: "0.82rem", color: "#1e3a8a", lineHeight: 1.5 }}>{tip}</li>
            ))}
          </ul>
        </Card>
      )}

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button className="btn btn-secondary" onClick={() => { /* parent handles via setActive via prop — add setActive if needed */ }}>← Back to Roof & Shading</button>
        <button className="btn btn-secondary" onClick={() => window.print()}>🖨 Print Roof Report</button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.35rem 0", borderBottom: "1px solid #f1f5f9", fontSize: "0.82rem" }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ fontWeight: 600, color: "#0f172a" }}>{value}</span>
    </div>
  );
}

function ElectricalAssessment({ survey, setSurvey, setActive }) {
  const set = (k, v) => setSurvey((s) => ({ ...s, [k]: v }));
  const dbConditions = ["Good", "Fair", "Needs upgrade"];
  const spareSpaceOpts = ["Yes — 2 spaces", "Yes — 1 space", "No — DB upgrade needed"];
  const wiringOpts = ["Good", "Needs partial rewire", "Needs full rewire"];
  const peakTimes = ["Morning", "Evening (5–10pm)", "All day", "Night only"];

  const needsDbUpgrade = survey.dbCondition === "Needs upgrade" || survey.spareBreakerSpace === "No — DB upgrade needed";

  return (
    <div className="grid-cols-2">
      <Card title="KPLC & DB details" subtitle="">
        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <SurveyCheck label="KPLC Active" checked={survey.kplcActive} onChange={(v) => set("kplcActive", v)} />
          <SurveyInput label="Meter Number" value={survey.meterNumber} onChange={(v) => set("meterNumber", v)} />
          <SurveySelect label="Phase Type" value={survey.phaseType} onChange={(v) => set("phaseType", v)} options={["", "Single Phase (230V)", "Three Phase (415V)"]} />
          <SurveyInput label="Main Breaker (A)" type="number" value={survey.mainBreakerA} onChange={(v) => set("mainBreakerA", v)} />
          <SurveySelect label="DB Condition" value={survey.dbCondition} onChange={(v) => set("dbCondition", v)} options={dbConditions} />
          <SurveySelect label="Spare Breaker Space" value={survey.spareBreakerSpace} onChange={(v) => set("spareBreakerSpace", v)} options={spareSpaceOpts} />
          <SurveyCheck label="Earthing Available" checked={survey.earthingAvailable} onChange={(v) => set("earthingAvailable", v)} />
          <SurveySelect label="Wiring Condition" value={survey.wiringCondition} onChange={(v) => set("wiringCondition", v)} options={wiringOpts} />
        </div>
        {!survey.earthingAvailable && (
          <AlertBox type="warning">⚠ No earthing. Earthing installation must be included in BoQ. Required for IEC 60364-7-712 compliance.</AlertBox>
        )}
        {needsDbUpgrade && (
          <AlertBox type="warning">⚠ DB upgrade required. Include distribution board replacement in BoQ and proposal notes.</AlertBox>
        )}
      </Card>

      <Card title="Usage & history" subtitle="">
        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <SurveyInput label="Monthly Bill (KES)" type="number" value={survey.monthlyBill} onChange={(v) => set("monthlyBill", v)} />
          <SurveySelect label="Peak Usage Time" value={survey.peakTime || "Evening (5–10pm)"} onChange={(v) => set("peakTime", v)} options={peakTimes} />
          <SurveyCheck label="Existing Generator" checked={survey.existingGenerator} onChange={(v) => set("existingGenerator", v)} />
          <SurveyCheck label="Existing Inverter/UPS" checked={survey.existingInverter} onChange={(v) => set("existingInverter", v)} />
        </div>
        {(!survey.earthingAvailable && !needsDbUpgrade) && (
          <AlertBox type="success">✓ Site appears electrically ready.</AlertBox>
        )}
        {survey.wiringCondition !== "Good" && (
          <AlertBox type="warning">⚠ Wiring condition: {survey.wiringCondition}. Include rewiring cost in BoQ.</AlertBox>
        )}
      </Card>

      <div style={{ gridColumn: "1 / -1", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={() => setActive("loads")}>Load Assessment →</button>
        <button className="btn btn-secondary" onClick={() => setActive("roof-shading")}>← Roof & Shading</button>
      </div>
    </div>
  );
}

function SitePhotos({ survey, setSurvey }) {
  const set = (k, v) => setSurvey((s) => ({ ...s, photos: { ...s.photos, [k]: v } }));
  const slots = [
    "Roof Front", "Roof Close-up", "Shading Source", "DB Box Open",
    "KPLC Meter", "Inverter Location", "Battery Location", "Cable Route",
    "Main Entrance", "Site Overview",
  ];
  const captured = slots.filter((s) => survey.photos[s]);

  return (
    <Card title="Site Photos" subtitle={`${captured.length} of ${slots.length} photos captured`}>
      {captured.length < slots.length && (
        <AlertBox type="warning">
          ⚠ {slots.filter((s) => !survey.photos[s]).join(", ")} — still missing. Proposal cannot be finalised until all mandatory photos are captured.
        </AlertBox>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginTop: "10px" }}>
        {slots.map((slot) => {
          const done = !!survey.photos[slot];
          return (
            <div
              key={slot}
              onClick={() => set(slot, !done)}
              style={{
                background: done ? "#ecfdf5" : "#f8fafc",
                border: `2px ${done ? "solid #10b981" : "dashed #e2e8f0"}`,
                borderRadius: "10px",
                aspectRatio: "4/3",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                cursor: "pointer",
                fontSize: "11px",
                color: done ? "#065f46" : "#94a3b8",
                textAlign: "center",
                padding: "8px",
              }}
            >
              <span style={{ fontSize: "22px" }}>{done ? "✓" : "📷"}</span>
              <span>{slot}{done ? " ✓" : ""}</span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: "0.75rem", fontSize: "12px", color: "var(--text-muted)" }}>
        Click a slot to mark as captured. Photos are auto-labelled with the site reference for filing.
      </div>
    </Card>
  );
}

function SafetyRisks({ survey, setSurvey }) {
  const set = (k, v) => setSurvey((s) => ({ ...s, [k]: v }));
  const risks = [
    { label: "Roof structural condition", ok: survey.roofCondition === "Good" || survey.roofCondition === "Fair", status: survey.roofCondition },
    { label: "No asbestos detected", ok: survey.roofType !== "Asbestos — Do Not Proceed", status: survey.roofType !== "Asbestos — Do Not Proceed" ? "Clear" : "ASBESTOS — Do Not Proceed" },
    { label: "Earthing available", ok: survey.earthingAvailable, status: withSurveyAssumption("earthingAvailable", survey.earthingAvailable ? "Available" : "Not available — add to BoQ", survey) },
    { label: "DB condition", ok: survey.dbCondition !== "Needs upgrade", status: survey.dbCondition },
    { label: "DB spare breaker space", ok: survey.spareBreakerSpace !== "No — DB upgrade needed", status: survey.spareBreakerSpace },
    { label: "Wiring condition", ok: survey.wiringCondition === "Good", status: survey.wiringCondition },
    { label: "KPLC supply active", ok: survey.kplcActive, status: survey.kplcActive ? "Active" : "No KPLC — off-grid sizing" },
    { label: "No severe shading", ok: survey.shadingSources.length === 0 || survey.shadingSources.includes("None"), status: survey.shadingSources.includes("None") || survey.shadingSources.length === 0 ? "None" : survey.shadingSources.join(", ") },
  ];

  const recommendations = ["✅ Proceed — strong site", "⚠ Proceed with modifications", "🔍 Engineer review required", "❌ Not recommended"];

  return (
    <Card title="Safety Assessment" subtitle="Derived from survey data. Review before issuing a commercial proposal.">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "1rem" }}>
        {risks.map((r, i) => (
          <div key={i} style={{ padding: "10px 12px", borderRadius: "10px", border: `1.5px solid ${r.ok ? "#86efac" : "#fcd34d"}`, background: r.ok ? "#f0fdf4" : "#fffbeb", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12.5px" }}>
            <span>{r.ok ? "✓" : "⚠"} {r.label}</span>
            <span style={{ fontSize: "11px", fontWeight: 600, color: r.ok ? "#166534" : "#92400e", marginLeft: "8px" }}>{r.status}</span>
          </div>
        ))}
      </div>

      {!survey.earthingAvailable && <AlertBox type="warning">⚠ No earthing confirmed. Add earthing to BoQ before submitting a proposal.</AlertBox>}
      {survey.dbCondition === "Needs upgrade" && <AlertBox type="warning">⚠ DB upgrade required. Include in BoQ and proposal notes.</AlertBox>}
      {survey.roofType === "Asbestos — Do Not Proceed" && <AlertBox type="danger">⛔ ASBESTOS DETECTED. Do not proceed until licensed asbestos removal is completed.</AlertBox>}

      <SurveySelect
        label="Engineer Recommendation"
        value={survey.engineerRecommendation || recommendations[0]}
        onChange={(v) => set("engineerRecommendation", v)}
        options={recommendations}
      />
    </Card>
  );
}

/* ─── END FIELD WORKFLOW COMPONENTS ─────────────────────────────────────── */

/* ─── ENGINEERING COMPLIANCE COMPONENT ──────────────────────────────────── */
function ComplianceRow({ label, value, ok, danger, note }) {
  const bg = danger ? "#fef2f2" : ok === false ? "#fffbeb" : ok === true ? "#f0fdf4" : "#f8fafc";
  const border = danger ? "#fca5a5" : ok === false ? "#fcd34d" : ok === true ? "#86efac" : "#e2e8f0";
  const icon = danger ? "❌" : ok === false ? "⚠️" : ok === true ? "✅" : "ℹ️";
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:"0.6rem 0.85rem", borderRadius:"0.45rem", border:`1px solid ${border}`, background:bg, marginBottom:"0.4rem", gap:"1rem" }}>
      <div style={{ flex:1 }}>
        <span style={{ fontSize:"0.85rem", fontWeight:600 }}>{icon} {label}</span>
        {note && <div style={{ fontSize:"0.75rem", color:"#64748b", marginTop:"0.15rem" }}>{note}</div>}
      </div>
      <span style={{ fontSize:"0.85rem", fontWeight:700, whiteSpace:"nowrap" }}>{value}</span>
    </div>
  );
}

function CommissionChecklist() {
  const items = [
    "Visual inspection of all components complete",
    "Module mounting torque checked to datasheet",
    "DC polarity verified at combiner and inverter",
    "String open-circuit voltage measured per string",
    "String short-circuit current measured per string",
    "Insulation resistance test completed (IEC 62446)",
    "Earth continuity test completed",
    "AC polarity and phase rotation verified",
    "Inverter startup and commissioning completed",
    "Battery initial charge cycle verified",
    "BMS communication and alarms verified",
    "Remote monitoring configured and live",
    "Anti-islanding and export limit settings verified",
    "Grid code compliance settings confirmed with KPLC",
    "Client handover and training completed",
    "As-built SLD attached and signed",
    "Manufacturer warranty documents collected",
    "EPRA/KPLC interconnection approval obtained",
  ];
  const [checked, setChecked] = useState({});
  const doneCount = Object.values(checked).filter(Boolean).length;
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"0.75rem" }}>
        <span style={{ fontWeight:700, fontSize:"0.9rem" }}>Commissioning Checklist (IEC 62446-1)</span>
        <span style={{ fontSize:"0.8rem", background: doneCount===items.length?"#dcfce7":"#f1f5f9", borderRadius:"0.4rem", padding:"0.2rem 0.7rem", fontWeight:700, color:doneCount===items.length?"#166534":"#475569" }}>
          {doneCount}/{items.length} complete
        </span>
      </div>
      {items.map((item, i) => (
        <label key={i} style={{ display:"flex", alignItems:"flex-start", gap:"0.6rem", padding:"0.45rem 0.65rem", borderRadius:"0.4rem", marginBottom:"0.3rem", background: checked[i]?"#f0fdf4":"#f8fafc", cursor:"pointer", fontSize:"0.85rem" }}>
          <input type="checkbox" checked={!!checked[i]} onChange={e => setChecked(prev=>({...prev,[i]:e.target.checked}))} style={{ marginTop:"0.15rem", accentColor:"#10b981" }} />
          <span style={{ color: checked[i]?"#166534":"#334155", textDecoration: checked[i]?"line-through":"none" }}>{item}</span>
        </label>
      ))}
      {doneCount < items.length && (
        <div style={{ marginTop:"0.5rem", fontSize:"0.78rem", color:"#92400e", background:"#fffbeb", padding:"0.5rem 0.75rem", borderRadius:"0.4rem", border:"1px solid #fcd34d" }}>
          ⚠️ {items.length - doneCount} item(s) outstanding. Do not sign off the installation until all items are verified.
        </div>
      )}
    </div>
  );
}

function EngineeringCompliance({ project, sizing, survey }) {
  const s = sizing;
  const phaseLbl = project.phase.includes("Three") ? "3-phase" : "1-phase";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1.5rem" }}>

      {/* A — DC String Protection */}
      <Card title="A. DC String Protection" subtitle="IEC 62548 §6.4.1 — string cable rating and fuse advisory">
        <ComplianceRow label="Module Isc" value={`${num(project.moduleIsc,2)} A`} ok={null} />
        <ComplianceRow label="Design cable rated current (1.25 × Isc)" value={`${num(s.dcCableRatedA,1)} A`} ok={null} note="Minimum conductor rating per IEC 62548 §6.4.1" />
        <ComplianceRow label="Number of parallel strings" value={`${s.strings}`} ok={null} />
        <ComplianceRow label="Panels per string" value={`${s.panelsPerString}`} ok={null} />
        <ComplianceRow label="PV array total current" value={`${num(s.pvArrayCurrentA,1)} A`} ok={null} note="strings × dcCableRatedA" />
        <ComplianceRow label="String fuse required?" value={s.dcStringFuseRequired ? "YES — recommended" : "May not be required"} ok={!s.dcStringFuseRequired} danger={false}
          note={s.dcStringFuseRequired ? "≥3 strings in parallel: string fuse required per IEC 62548" : "≤2 strings: check IEC 62548 and module datasheet max series fuse"} />
        {s.dcStringFuseRequired && (
          <ComplianceRow label="Suggested string fuse rating" value={`${s.suggestedStringFuseA} A DC`} ok={null} note="Advisory only. Confirm against module datasheet maximum series fuse rating." />
        )}
        <ComplianceRow label="String Voc cold" value={`${num(s.stringVocCold,1)} V`} ok={s.coldVocOk} danger={!s.coldVocOk} note={`At ${project.minTemp}°C minimum site temperature`} />
        <ComplianceRow label="Inverter max DC voltage" value={`${project.inverterMaxDcV} V`} ok={null} />
        <ComplianceRow label="Cold Voc margin" value={`${num(s.coldVocMargin,1)} V`} ok={s.coldVocMargin >= 100} danger={s.coldVocMargin < 0}
          note={s.coldVocMargin < 100 ? "Margin is narrow — confirm site minimum temperature" : "Adequate margin"} />
        <div style={{ fontSize:"0.76rem", color:"#64748b", marginTop:"0.5rem", background:"#f8fafc", padding:"0.6rem 0.8rem", borderRadius:"0.4rem" }}>
          ℹ️ String fuse sizing is advisory only. Final rating must be confirmed against module datasheet maximum series fuse rating, cable ampacity, and local protection coordination study.
        </div>
      </Card>

      {/* B — DC Isolator Advisory */}
      <Card title="B. DC Isolator / DC Disconnect Advisory" subtitle="Minimum ratings for DC array isolator switch">
        <ComplianceRow label="Minimum DC isolator voltage rating" value={`${s.dcIsolatorVoltageRating} V DC`} ok={null} note="Next standard rating above string Voc cold" />
        <ComplianceRow label="Minimum DC isolator current rating" value={`${s.dcIsolatorCurrentRating} A DC`} ok={null} note="Next standard rating above PV array total current" />
        <ComplianceRow label="Recommended location" value="Between PV array and inverter MPPT input" ok={null} />
        <div style={{ fontSize:"0.76rem", color:"#64748b", marginTop:"0.5rem", background:"#f8fafc", padding:"0.6rem 0.8rem", borderRadius:"0.4rem" }}>
          ℹ️ DC isolators must be rated for DC interrupting duty. Never use AC-rated isolators on DC circuits.
        </div>
      </Card>

      {/* C — AC Protection */}
      <Card title="C. AC Protection Advisory" subtitle="IEC 60364-7-712 — AC output protection sizing">
        <ComplianceRow label="Inverter AC output current" value={`${num(s.acCurrent,1)} A (${phaseLbl})`} ok={null} />
        <ComplianceRow label="AC breaker design current (× 1.25)" value={`${num(s.acBreakerDesignA,1)} A`} ok={null} />
        <ComplianceRow label="Suggested AC breaker rating" value={`${s.suggestedAcBreakerA} A`} ok={null} note="Next standard MCB/MCCB size above design current" />
        <ComplianceRow label="AC voltage drop" value={`${pct(s.acDropPct)}`} ok={s.acDropPct <= 0.03} danger={s.acDropPct > 0.03} note="Max 3% recommended (IEC 60364-5-52)" />
        <div style={{ fontSize:"0.76rem", color:"#64748b", marginTop:"0.5rem", background:"#f8fafc", padding:"0.6rem 0.8rem", borderRadius:"0.4rem" }}>
          ℹ️ Final breaker selection must coordinate with cable ampacity, inverter manual specifications, DB capacity, prospective fault current, and KEBS/local regulations.
        </div>
      </Card>

      {/* D — Cable Ampacity */}
      <Card title="D. Cable Ampacity Advisory" subtitle="Conservative copper cable ratings — IEC 60364 / BS 7671 typical installation">
        <div style={{ overflowX:"auto", marginBottom:"0.75rem" }}>
          <table className="table" style={{ fontSize:"0.82rem" }}>
            <thead>
              <tr><th>Cable mm²</th><th>Advisory A</th><th>DC selected?</th><th>AC selected?</th></tr>
            </thead>
            <tbody>
              {Object.entries(s.cableAmpacityTable).map(([mm, amps]) => (
                <tr key={mm} style={{ background: Number(mm)===project.dcCableSizeMm2||Number(mm)===project.acCableSizeMm2 ? "#f0fdf4":"" }}>
                  <td>{mm} mm²</td>
                  <td>{amps} A</td>
                  <td>{Number(mm)===project.dcCableSizeMm2 ? "✅ DC" : ""}</td>
                  <td>{Number(mm)===project.acCableSizeMm2 ? "✅ AC" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ComplianceRow label={`DC cable ${project.dcCableSizeMm2}mm² vs design current ${num(s.dcCableRatedA,1)}A`}
          value={!s.dcCableAdvisoryA ? "Not checked — engineer verification required" : s.dcCableAmpacityOk ? `${s.dcCableAdvisoryA}A OK` : `${s.dcCableAdvisoryA}A — UNDERSIZED`}
          ok={s.dcCableAmpacityOk} danger={!s.dcCableAmpacityOk && s.dcCableAdvisoryA > 0} />
        <ComplianceRow label={`AC cable ${project.acCableSizeMm2}mm² vs breaker design ${num(s.acBreakerDesignA,1)}A`}
          value={!s.acCableAdvisoryA ? "Not checked — engineer verification required" : s.acCableAmpacityOk ? `${s.acCableAdvisoryA}A OK` : `${s.acCableAdvisoryA}A — UNDERSIZED`}
          ok={s.acCableAmpacityOk} danger={!s.acCableAmpacityOk && s.acCableAdvisoryA > 0} />
        <div style={{ fontSize:"0.76rem", color:"#64748b", marginTop:"0.5rem", background:"#f8fafc", padding:"0.6rem 0.8rem", borderRadius:"0.4rem" }}>
          ⚠️ Advisory ampacity only. Final cable sizing must account for installation method, conduit grouping, ambient and roof temperature, insulation type, voltage drop, and protection coordination.
        </div>
      </Card>

      {/* E — Earthing */}
      <Card title="E. Earthing and Bonding Checklist" subtitle="IEC 62548 §8 / IEC 60364-7-712 §712.54">
        {[
          "PV module frame bonding to mounting rail",
          "Mounting rail bonding to earth bar",
          "Inverter PE earth connection",
          "Battery rack and enclosure earth connection",
          "Distribution board earth bar",
          "Earth electrode — type and resistance to be measured",
          "SPD earth conductor — short and direct routing",
          "Earth continuity test to be completed during commissioning",
        ].map((item, i) => (
          <ComplianceRow key={i} label={item} value="Required" ok={null} />
        ))}
        {survey && survey.earthingAvailable === false && (
          <div style={{ marginTop:"0.5rem", padding:"0.75rem 1rem", background:"#fef2f2", border:"1.5px solid #fca5a5", borderRadius:"0.5rem", fontSize:"0.85rem", color:"#7f1d1d", fontWeight:600 }}>
            🔴 HIGH RISK: Earthing not confirmed at site survey. Do not proceed to final proposal without earthing verification or earth upgrade BoQ line item.
          </div>
        )}
        {survey && survey.earthingAvailable && (
          <div style={{ marginTop:"0.5rem", padding:"0.6rem 0.85rem", background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:"0.4rem", fontSize:"0.8rem", color:"#92400e" }}>
            ⚠️ Earthing indicated as available at survey. Final earth continuity and resistance measurements required during commissioning.
          </div>
        )}
      </Card>

      {/* F — Surge Protection */}
      <Card title="F. Surge Protection (SPD) Checklist" subtitle="IEC 62305-3 / IEC 61643 — lightning and surge advisory">
        <ComplianceRow label="DC SPD Type II" value="Recommended" ok={null} note="Install between PV array and inverter DC terminals" />
        <ComplianceRow label="AC SPD Type II" value="Recommended" ok={null} note="Install at DB on AC output side" />
        <ComplianceRow label="DC cable route length" value={`${project.dcCableLengthM}m`} ok={project.dcCableLengthM <= 30} danger={false}
          note={project.dcCableLengthM > 30 ? "Long DC run increases surge exposure — Type II SPD strongly advised" : "Standard route"} />
        <ComplianceRow label="AC cable route length" value={`${project.acCableLengthM}m`} ok={project.acCableLengthM <= 30} danger={false}
          note={project.acCableLengthM > 30 ? "Long AC run — consider additional SPD near load centre" : "Standard route"} />
        <div style={{ fontSize:"0.76rem", color:"#64748b", marginTop:"0.5rem", background:"#f8fafc", padding:"0.6rem 0.8rem", borderRadius:"0.4rem" }}>
          ℹ️ SPD effectiveness depends on correct earthing and short earth conductor routing. Kenya's equatorial location has elevated lightning risk in highland areas.
        </div>
      </Card>

      {/* G — Battery Safety */}
      <Card title="G. Battery Safety Checklist" subtitle="IEC 61427 / IEC 62485-2 — storage system safety">
        <ComplianceRow label="Battery chemistry" value={batteryChemistries[project.batteryChemistry]?.label ?? project.batteryChemistry} ok={null} />
        <ComplianceRow label="Battery voltage" value={`${project.batteryVoltage}V nominal`} ok={null} />
        <ComplianceRow label="Battery bank capacity" value={`${num(s.batteryKwh,1)} kWh`} ok={null} />
        <ComplianceRow label="BMS max charge current" value={`${num(s.bmsMaxChargeA,0)}A`} ok={null} />
        <ComplianceRow label="BMS max discharge current" value={`${num(s.bmsMaxDischargeA,0)}A`} ok={null} />
        <ComplianceRow label="Inverter peak battery draw" value={`${num(s.batteryInputA,0)}A`} ok={s.batteryInputA <= s.bmsMaxDischargeA} danger={s.batteryInputA > s.bmsMaxDischargeA}
          note={s.batteryInputA > s.bmsMaxDischargeA ? "Add parallel battery strings or increase bank voltage" : "Within BMS limits"} />
        <ComplianceRow label="DC fuse/breaker between battery and inverter" value="Required" ok={null} />
        <ComplianceRow label="Battery DC isolator" value="Required" ok={null} />
        {(project.batteryChemistry === "VRLA" || project.batteryChemistry === "FLOODED") && (
          <div style={{ marginTop:"0.5rem", padding:"0.75rem 1rem", background:"#fef2f2", border:"1.5px solid #fca5a5", borderRadius:"0.5rem", fontSize:"0.85rem", color:"#7f1d1d", fontWeight:600 }}>
            🔴 LEAD-ACID SAFETY: These batteries release hydrogen gas during charging (IEC 62485-2). Install compliant ventilation, maintain separation from sparks/flame, provide acid containment, and label battery compartment clearly.
          </div>
        )}
        {(project.batteryChemistry === "LFP" || project.batteryChemistry === "NMC") && (
          <div style={{ marginTop:"0.5rem", padding:"0.6rem 0.85rem", background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:"0.4rem", fontSize:"0.8rem", color:"#92400e" }}>
            ⚠️ Lithium: Confirm manufacturer spacing and wall clearance, BMS communication protocol, DC fuse ratings, and fire-safe location away from flammable materials.
          </div>
        )}
      </Card>

      {/* H — Grid Interconnection */}
      <Card title="H. Grid Interconnection Checklist" subtitle="Kenya Energy Act 2019 / KPLC/EPRA requirements">
        {(project.systemType === "Solar PV – Hybrid" || project.systemType === "Genset hybrid") && (
          <div style={{ display:"flex", flexDirection:"column", gap:"0.4rem" }}>
            <ComplianceRow label="Anti-islanding protection" value="Required — certified inverter" ok={null} note="Per EPRA interconnection standard" />
            <ComplianceRow label="Generation Licence or EPRA Exemption" value="Required before energisation" ok={null} />
            <ComplianceRow label="Export limitation setting" value="Confirm if zero-export or export-limit design" ok={null} />
            <ComplianceRow label="Inverter grid-code compliance" value="Confirm with KPLC distribution" ok={null} />
            <ComplianceRow label="Commissioning by licensed electrical contractor" value="Required" ok={null} />
          </div>
        )}
        {project.systemType === "Off-grid" && (
          <div style={{ display:"flex", flexDirection:"column", gap:"0.4rem" }}>
            <ComplianceRow label="Changeover / islanding separation" value="Hard separation required" ok={null} />
            <ComplianceRow label="No backfeed into KPLC supply" value="Confirm isolation interlock" ok={null} />
            <ComplianceRow label="Earthing arrangement for islanded system" value="TN-S or TT as designed" ok={null} />
          </div>
        )}
        {project.systemType === "Mini-grid" && (
          <div style={{ display:"flex", flexDirection:"column", gap:"0.4rem" }}>
            <ComplianceRow label="Mini-grid licence / REA/REREC registration" value="Required" ok={null} />
            <ComplianceRow label="Distribution protection and metering" value="Required — DLMS/COSEM smart meters" ok={null} />
            <ComplianceRow label="Community tariff — regulatory approval" value="Required before commercial operation" ok={null} />
          </div>
        )}
        {project.systemType === "EV charging" && (
          <div style={{ display:"flex", flexDirection:"column", gap:"0.4rem" }}>
            <ComplianceRow label="KPLC grid connection capacity" value={s.gridConnOk ? "Adequate" : "INADEQUATE — upgrade required"} ok={s.gridConnOk} danger={!s.gridConnOk} />
            <ComplianceRow label="OCPP / load management" value={s.ocppRequired ? "Required (≥4 chargers)" : "Optional"} ok={null} />
            <ComplianceRow label="EV charger CE/IEC marking" value="Required — IEC 61851 / IEC 62196" ok={null} />
          </div>
        )}
      </Card>

      {/* I — Commissioning Checklist */}
      <Card title="I. Commissioning Checklist" subtitle="IEC 62446-1 — PV system documentation and commissioning tests">
        <CommissionChecklist />
      </Card>

      {/* Disclaimer */}
      <div style={{ padding:"1rem 1.25rem", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:"0.5rem", fontSize:"0.8rem", color:"#64748b", lineHeight:1.6 }}>
        <b>Engineering Compliance Disclaimer:</b> This tab provides advisory and checklist guidance only. Voltages, currents, and ratings are calculated from user-entered values. Final protection coordination, cable ampacity with derating, earthing design, grid interconnection settings, and commissioning sign-off must be performed by a qualified and licensed electrical engineer. Voltflow Energy Solutions accepts no liability for reliance on these advisory outputs without independent engineering verification.
      </div>

    </div>
  );
}
/* ─── END ENGINEERING COMPLIANCE ─────────────────────────────────────── */

/* ─── V8: DECISION INTELLIGENCE COMPONENTS ──────────────────────────── */

// ── Readiness score ring ────────────────────────────────────────────────────────
function ScoreRing({ score, max = 100, size = 80, colour }) {
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const frac = Math.min(score / max, 1);
  const col = colour || (score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444");
  return (
    <svg width={size} height={size} style={{ flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth="8"
        strokeDasharray={`${circ * frac} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2+5} textAnchor="middle" fontSize="15" fontWeight="800" fill={col}>{score}</text>
    </svg>
  );
}

// ── Quote Governance Panel ──────────────────────────────────────────────────────
function QuoteGovernancePanel({ governance, project, setProject, showToast }) {
  if (!governance) return null;
  const { status, approvals, nextAction, computedStatus } = governance;
  const statusColour = status === "Ready to send" || status === "Won" ? "#10b981"
    : status === "High risk — do not send" || status === "Lost" ? "#ef4444"
    : status === "Manager review required" ? "#7c3aed"
    : status === "Sent" ? "#3b82f6"
    : "#f59e0b";
  const stage = project?.quoteStage || "auto";
  const setStage = (v) => {
    if (!setProject) return;
    setProject((p) => ({ ...p, quoteStage: v }));
    if (showToast) showToast(v === "auto" ? "Quote stage reset — status follows the computed governance again." : `Quote marked as ${v}.`);
  };
  return (
    <div style={{ padding:"1rem", background:"#f8fafc", border:`2px solid ${statusColour}`, borderRadius:"0.65rem" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"0.75rem" }}>
        <div style={{ background:statusColour, color:"#fff", fontWeight:700, fontSize:"0.8rem", padding:"0.25rem 0.75rem", borderRadius:"2rem", whiteSpace:"nowrap" }}>
          {status}
        </div>
        <span style={{ fontSize:"0.85rem", fontWeight:600, color:"#0f172a" }}>Quote Governance</span>
      </div>
      {stage !== "auto" && computedStatus && (
        <div style={{ fontSize:"0.75rem", color:"#64748b", marginBottom:"0.6rem" }}>
          Underlying computed status: <b>{computedStatus}</b>
        </div>
      )}
      {setProject && (
        <div style={{ display:"flex", gap:"0.35rem", flexWrap:"wrap", marginBottom:"0.75rem" }}>
          {stage === "auto" && (
            <button onClick={() => setStage("Sent")} className="btn btn-primary" style={{ fontSize:"0.75rem", padding:"0.25rem 0.7rem" }}>📤 Mark Sent</button>
          )}
          {stage === "Sent" && (<>
            <button onClick={() => setStage("Won")}  style={{ fontSize:"0.75rem", padding:"0.25rem 0.7rem", background:"#10b981", color:"#fff", border:"none", borderRadius:"0.35rem", cursor:"pointer", fontWeight:700 }}>🏆 Won</button>
            <button onClick={() => setStage("Lost")} style={{ fontSize:"0.75rem", padding:"0.25rem 0.7rem", background:"#ef4444", color:"#fff", border:"none", borderRadius:"0.35rem", cursor:"pointer", fontWeight:700 }}>✖ Lost</button>
          </>)}
          {stage !== "auto" && (
            <button onClick={() => setStage("auto")} className="btn btn-secondary" style={{ fontSize:"0.75rem", padding:"0.25rem 0.7rem" }}>↺ Back to auto</button>
          )}
        </div>
      )}
      {approvals.length > 0 && (
        <div style={{ marginBottom:"0.6rem" }}>
          <div style={{ fontSize:"0.78rem", fontWeight:700, color:"#475569", marginBottom:"0.3rem" }}>REQUIRED APPROVALS</div>
          {approvals.map((a, i) => (
            <div key={i} style={{ fontSize:"0.82rem", padding:"0.3rem 0.5rem", background:"#fff", border:"1px solid #e2e8f0", borderRadius:"0.35rem", marginBottom:"0.25rem" }}>
              👤 <b>{a.role}</b> — {a.reason}
            </div>
          ))}
        </div>
      )}
      {nextAction.length > 0 && (
        <div>
          <div style={{ fontSize:"0.78rem", fontWeight:700, color:"#475569", marginBottom:"0.3rem" }}>NEXT ACTION</div>
          {nextAction.map((a, i) => (
            <div key={i} style={{ fontSize:"0.82rem", color:"#334155" }}>→ {a}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Project Readiness Tab ───────────────────────────────────────────────────────
function ProjectReadinessTab({ readiness, advisory, confidence, governance, quickWins, project, sizing, setProject, showToast }) {
  if (!readiness) return <div className="carbon-info">Readiness data unavailable.</div>;
  const { totalScore, categoryScores, blockers, warnings, recommendations, readyStatus } = readiness;
  const statusColour = readyStatus === "Ready to propose" ? "#10b981" : readyStatus === "Ready with engineer review" ? "#f59e0b" : readyStatus === "High risk — do not send" ? "#ef4444" : "#64748b";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1.5rem" }}>

      {/* Header score */}
      <div style={{ display:"flex", gap:"1.5rem", alignItems:"center", flexWrap:"wrap", padding:"1.25rem 1.5rem", background:"#f8fafc", border:"2px solid #e2e8f0", borderRadius:"0.75rem" }}>
        <ScoreRing score={totalScore} size={90} />
        <div style={{ flex:1 }}>
          <div style={{ fontSize:"1.1rem", fontWeight:800, color:statusColour, marginBottom:"0.25rem" }}>{readyStatus}</div>
          <div style={{ fontSize:"0.85rem", color:"#475569" }}>Project Readiness Score: <b>{totalScore}/100</b></div>
          <div style={{ fontSize:"0.8rem", color:"#64748b", marginTop:"0.25rem" }}>
            {blockers.length > 0 && <span style={{ color:"#ef4444", fontWeight:600 }}>{blockers.length} blocker(s) · </span>}
            {warnings.length > 0 && <span style={{ color:"#f59e0b", fontWeight:600 }}>{warnings.length} warning(s) · </span>}
            {recommendations.length} recommendation(s)
          </div>
        </div>
        <QuoteGovernancePanel governance={governance} project={project} setProject={setProject} showToast={showToast} />
      </div>

      {/* Category breakdown */}
      <Card title="Score Breakdown" subtitle="Six categories — hover each item for pass/fail detail.">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))", gap:"1rem" }}>
          {Object.entries(categoryScores).map(([cat, { score, max, items }]) => (
            <div key={cat} style={{ padding:"0.85rem", background:"#f8fafc", borderRadius:"0.6rem", border:"1px solid #e2e8f0" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.5rem" }}>
                <span style={{ fontWeight:700, fontSize:"0.85rem", textTransform:"capitalize" }}>{cat}</span>
                <span style={{ fontWeight:800, fontSize:"0.9rem", color: score >= max * 0.75 ? "#10b981" : score >= max * 0.5 ? "#f59e0b" : "#ef4444" }}>{score}/{max}</span>
              </div>
              <div style={{ height:"6px", background:"#e2e8f0", borderRadius:"3px", overflow:"hidden", marginBottom:"0.5rem" }}>
                <div style={{ height:"100%", width:`${Math.round(score / max * 100)}%`, background: score >= max * 0.75 ? "#10b981" : score >= max * 0.5 ? "#f59e0b" : "#ef4444", borderRadius:"3px" }} />
              </div>
              {items.slice(0, 4).map((item, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.75rem", color: item.pass ? "#166534" : "#7f1d1d", marginBottom:"0.15rem" }}>
                  {item.pass ? "✅" : "❌"} {item.label}
                </div>
              ))}
              {items.length > 4 && <div style={{ fontSize:"0.72rem", color:"#94a3b8", marginTop:"0.2rem" }}>+{items.length - 4} more checks</div>}
            </div>
          ))}
        </div>
      </Card>

      {/* Blockers */}
      {blockers.length > 0 && (
        <Card title="Blockers — resolve before sending" subtitle="These must be fixed before any proposal is issued.">
          {blockers.map((b, i) => (
            <div key={i} style={{ padding:"0.65rem 0.9rem", background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:"0.45rem", marginBottom:"0.4rem", fontSize:"0.85rem", color:"#7f1d1d", fontWeight:600 }}>
              🚫 {b}
            </div>
          ))}
        </Card>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card title="Warnings" subtitle="Important but not immediate blockers.">
          {warnings.map((w, i) => (
            <div key={i} style={{ padding:"0.55rem 0.85rem", background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:"0.4rem", marginBottom:"0.3rem", fontSize:"0.82rem", color:"#92400e" }}>
              ⚠️ {w}
            </div>
          ))}
        </Card>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card title="Recommendations" subtitle="Actions to improve readiness and proposal quality.">
          {recommendations.map((r, i) => (
            <div key={i} style={{ padding:"0.5rem 0.85rem", background:"#f0fdf4", border:"1px solid #86efac", borderRadius:"0.4rem", marginBottom:"0.3rem", fontSize:"0.82rem", color:"#166534" }}>
              💡 {r}
            </div>
          ))}
        </Card>
      )}

      {/* Advisory from engine */}
      {advisory && (
        <Card title="Voltflow Advisory Engine" subtitle="Rule-based guidance for engineering, commercial, sales, and operations.">
          {[
            { label: "Engineering", items: advisory.engineeringAdvice, icon: "🔧", bg: "#fef2f2", border: "#fca5a5", text: "#7f1d1d" },
            { label: "Commercial",  items: advisory.commercialAdvice,  icon: "💰", bg: "#fffbeb", border: "#fcd34d", text: "#92400e" },
            { label: "Sales",       items: advisory.salesAdvice,       icon: "🤝", bg: "#f0fdf4", border: "#86efac", text: "#166534" },
            { label: "Operations",  items: advisory.operationalAdvice, icon: "📋", bg: "#eff6ff", border: "#93c5fd", text: "#1e3a8a" },
          ].map(({ label, items, icon, bg, border, text }) => items.length > 0 && (
            <div key={label} style={{ marginBottom:"0.75rem" }}>
              <div style={{ fontSize:"0.8rem", fontWeight:700, color:"#475569", marginBottom:"0.35rem" }}>{icon} {label.toUpperCase()}</div>
              {items.map((item, i) => (
                <div key={i} style={{ padding:"0.5rem 0.75rem", background:bg, border:`1px solid ${border}`, borderRadius:"0.4rem", marginBottom:"0.25rem", fontSize:"0.82rem", color:text }}>
                  {item}
                </div>
              ))}
            </div>
          ))}
        </Card>
      )}

      {/* Assumption confidence */}
      {confidence && (
        <Card title="Assumption Confidence" subtitle="How reliable is the data behind this proposal?">
          <div style={{ display:"flex", alignItems:"center", gap:"1rem", marginBottom:"0.75rem" }}>
            <ScoreRing score={confidence.score} size={70} />
            <div>
              <div style={{ fontWeight:700, fontSize:"0.9rem" }}>{confidence.level} Confidence ({confidence.score}%)</div>
              {confidence.weakItems.length > 0 && (
                <div style={{ fontSize:"0.78rem", color:"#92400e", marginTop:"0.2rem" }}>Weak: {confidence.weakItems.join(", ")}</div>
              )}
            </div>
          </div>
          {confidence.items.map((item, i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"0.35rem 0.5rem", background: item.conf < 0.6 ? "#fffbeb" : "#f8fafc", borderRadius:"0.35rem", marginBottom:"0.2rem", fontSize:"0.8rem" }}>
              <span>{item.label}</span>
              <span style={{ fontWeight:600, color: item.conf >= 0.8 ? "#166534" : item.conf >= 0.6 ? "#92400e" : "#7f1d1d" }}>{item.conf >= 0.8 ? "High" : item.conf >= 0.6 ? "Medium" : "Low"}</span>
            </div>
          ))}
        </Card>
      )}

      {/* Quick wins */}
      {quickWins && quickWins.length > 0 && (
        <Card title="Quick Wins Before Solar" subtitle="Efficiency improvements that reduce system size or cost.">
          {quickWins.map((w, i) => (
            <div key={i} style={{ padding:"0.65rem 0.85rem", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:"0.45rem", marginBottom:"0.4rem" }}>
              <div style={{ fontWeight:600, fontSize:"0.85rem", color:"#0f172a", marginBottom:"0.15rem" }}>{w.rec}</div>
              <div style={{ fontSize:"0.78rem", color:"#475569", marginBottom:"0.2rem" }}>{w.detail}</div>
              <div style={{ display:"flex", gap:"0.5rem" }}>
                {[["Impact", w.impact], ["Cost", w.cost], ["Priority", w.priority]].map(([k, v]) => (
                  <span key={k} style={{ fontSize:"0.72rem", fontWeight:600, padding:"0.15rem 0.5rem", borderRadius:"1rem", background: v === "High" || v === "Immediate" ? "#dcfce7" : v === "Medium" || v === "Before installation" ? "#fef3c7" : "#f1f5f9", color: v === "High" || v === "Immediate" ? "#166534" : v === "Medium" || v === "Before installation" ? "#92400e" : "#475569" }}>
                    {k}: {v}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ── System Options Tab ──────────────────────────────────────────────────────────
function SystemOptionsTab({ options, project, setProject, sizing, advisory, roofGeometry, multiRoofDist, activeFaces }) {
  if (!options) {
    return (
      <Card title="System Options" subtitle="Available for Solar PV Hybrid, Off-grid, and Genset Hybrid system types.">
        <div className="carbon-info">Change system type to Hybrid, Off-grid, or Genset Hybrid to generate comparison options.</div>
      </Card>
    );
  }

  const colours = { essential: "#3b82f6", recommended: "#10b981", premium: "#7c3aed" };
  const formatCost = (v) => `KES ${Math.round(v / 1000)}k`;
  const formatPb   = (v) => Number.isFinite(v) ? `${v.toFixed(1)} yr` : "N/A";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1.5rem" }}>
      <div style={{ padding:"0.75rem 1rem", background:"#eff6ff", border:"1px solid #93c5fd", borderRadius:"0.5rem", fontSize:"0.83rem", color:"#1e3a8a" }}>
        ℹ️ These three options are generated from your current project settings with adjusted solar coverage, backup hours, and autonomy. Prices are indicative — confirm with actual supplier quotes before sending to client.
        <div style={{ marginTop: "0.3rem", fontSize: "0.72rem", fontFamily: "monospace" }}>
          {options[0]?.calculation_version || DESIGN_CALCULATION_VERSION} · {options[0]?.inputs_hash ? options[0].inputs_hash.slice(0, 24) + "…" : "calculating revision hash"}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))", gap:"1.25rem" }}>
        {options.map(opt => {
          const r = opt.result;
          const col = colours[opt.id] || "#475569";
          const isRec = opt.id === "balanced";
          const isSelected = project.selectedDesignOption?.id === opt.id
            && project.selectedDesignOption?.inputs_hash === opt.inputs_hash;
          // Per-option roof fit — use multi-roof total capacity if available
          const multiCap = multiRoofDist?.totalCapacity || 0;
          const roofCap  = multiCap > 0 ? multiCap : (roofGeometry ? Math.floor(roofGeometry.roofAreaUsableM2 / ((project.panelLengthM || 2.28) * (project.panelWidthM || 1.13))) : 0);
          const optFit = roofCap > 0
            ? (r.panels <= roofCap * 0.8 ? "Fits comfortably"
              : r.panels <= roofCap ? "Fits with limited space"
              : "Does not fit — alt. mounting needed")
            : "Roof area not confirmed";
          const fitColour = optFit.startsWith("Fits comfortably") ? "#10b981" : optFit.startsWith("Fits with") ? "#f59e0b" : optFit.startsWith("Does not") ? "#ef4444" : "#94a3b8";
          const altMountingNeeded = optFit.startsWith("Does not fit");
          return (
            <div key={opt.id} style={{ border:`2px solid ${isRec ? col : "#e2e8f0"}`, borderRadius:"0.75rem", overflow:"hidden", position:"relative" }}>
              {isRec && (
                <div style={{ background:col, color:"#fff", textAlign:"center", fontSize:"0.75rem", fontWeight:700, padding:"0.25rem" }}>
                  ⭐ RECOMMENDED
                </div>
              )}
              <div style={{ padding:"1rem 1.1rem" }}>
                <div style={{ fontSize:"1rem", fontWeight:800, color:col, marginBottom:"0.15rem" }}>{opt.label}</div>
                <div style={{ fontSize:"0.78rem", color:"#64748b", marginBottom:"0.4rem" }}>{opt.desc}</div>
                {/* Roof fit badge per option */}
                <div style={{ marginBottom:"0.6rem", padding:"0.25rem 0.6rem", background: altMountingNeeded ? "#fef2f2" : optFit.startsWith("Fits with") ? "#fffbeb" : "#f0fdf4", borderRadius:"0.35rem", fontSize:"0.72rem", fontWeight:700, color:fitColour }}>
                  🏠 Roof fit: {optFit} · {r.panels} panels req. / {roofCap || "?"} cap.
                  {altMountingNeeded && " — carport / ground mount / 2nd roof face needed"}
                </div>
                {altMountingNeeded && opt.id === "premium" && (
                  <div style={{ marginBottom:"0.5rem", fontSize:"0.72rem", color:"#7f1d1d", background:"#fef2f2", padding:"0.25rem 0.5rem", borderRadius:"0.3rem" }}>
                    ⛔ Premium option requires alternative mounting area. Recommend Balanced option or confirm additional roof/carport capacity.
                  </div>
                )}

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.4rem", marginBottom:"0.75rem" }}>
                  {[
                    ["PV Array", `${r.actualKwp.toFixed(1)} kWp`],
                    ["Panels", `${r.panels} × ${project.panelW}W`],
                    ["Battery", `${r.battKwh.toFixed(1)} kWh`],
                    ["Modules", `${r.battModules} modules`],
                    ["Inverter", `${r.invKw} kW`],
                    ["Backup", `~${r.autonomyH.toFixed(1)} hrs`],
                    ["Est. Cost", formatCost(r.totalCost)],
                    ["Payback", formatPb(r.payback)],
                    ["Annual Savings", formatCost(r.annualSavings)],
                    ["Daily Energy", `${r.dailyKwh.toFixed(1)} kWh`],
                  ].map(([k, v]) => (
                    <div key={k} style={{ background:"#f8fafc", borderRadius:"0.35rem", padding:"0.3rem 0.5rem" }}>
                      <div style={{ fontSize:"0.68rem", color:"#94a3b8", fontWeight:600 }}>{k}</div>
                      <div style={{ fontSize:"0.82rem", fontWeight:700, color:"#0f172a" }}>{v}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom:"0.6rem" }}>
                  <div style={{ fontSize:"0.72rem", fontWeight:700, color:"#166534", marginBottom:"0.2rem" }}>✅ PROS</div>
                  {opt.pros.map((p, i) => <div key={i} style={{ fontSize:"0.77rem", color:"#166534", marginBottom:"0.1rem" }}>• {p}</div>)}
                </div>
                <div style={{ marginBottom:"0.6rem" }}>
                  <div style={{ fontSize:"0.72rem", fontWeight:700, color:"#92400e", marginBottom:"0.2rem" }}>⚠️ CONS</div>
                  {opt.cons.map((c, i) => <div key={i} style={{ fontSize:"0.77rem", color:"#92400e", marginBottom:"0.1rem" }}>• {c}</div>)}
                </div>
                <div style={{ fontSize:"0.77rem", color:"#475569", background:"#f8fafc", padding:"0.4rem 0.6rem", borderRadius:"0.35rem" }}>
                  👤 <b>Best for:</b> {opt.bestFor}
                </div>
                <button
                  className={`btn ${isSelected ? "btn-primary" : "btn-secondary"}`}
                  disabled={r.loadInventoryBlocked || !opt.inputs_hash}
                  style={{ marginTop: "0.75rem", width: "100%" }}
                  onClick={() => setProject((current) => ({
                    ...current,
                    selectedDesignOption: {
                      id: opt.id,
                      label: opt.label,
                      inputs_hash: opt.inputs_hash,
                      revision_id: opt.revision_id,
                      calculation_version: opt.calculation_version,
                      result: opt.result,
                      selected_at: new Date().toISOString(),
                    },
                  }))}
                >{isSelected ? "Selected for this revision" : "Select option"}</button>
              </div>
            </div>
          );
        })}
      </div>

      {advisory?.salesAdvice?.length > 0 && (
        <Card title="Sales Guidance" subtitle="Based on project profile and system sizing.">
          {advisory.salesAdvice.map((a, i) => (
            <div key={i} style={{ padding:"0.5rem 0.75rem", background:"#f0fdf4", border:"1px solid #86efac", borderRadius:"0.4rem", marginBottom:"0.3rem", fontSize:"0.82rem", color:"#166534" }}>
              🤝 {a}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ─── END V8 DECISION INTELLIGENCE COMPONENTS ───────────────────────── */

/* ═══════════════════════════════════════════════════════════════════════
   INSTALLER SIMULATION STUDIO — v8.4
   ═══════════════════════════════════════════════════════════════════════ */

/** 2D SVG roof canvas — pure SVG, no external dependencies */
// Single-canvas roof layout doesn't yet model distinct per-face grids, but the
// manual-edit keys (selectedPanelKey / manualRemovedPanels) are stored keyed by
// face id so a future multi-face grid can reuse the same shape. This is the key
// used for the one grid RoofCanvas currently renders.
const PRIMARY_FACE_KEY = "primary-roof";

const arrowPadBtnStyle = {
  width: "32px", height: "32px", borderRadius: "0.35rem", border: "1px solid #cbd5e1",
  background: "#fff", cursor: "pointer", fontSize: "0.9rem",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
};

function RoofCanvas({ project, survey, sizing, simulation, panelLayout, roofGeometry, setSimulation, stringPlan }) {
  const SVG_W = 720, SVG_H = 460, MARGIN = 55;

  const roofLM = Math.max(Number(survey.roofLengthM)  || Number(project.blueprintRoofLengthM) || 12, 1);
  const roofWM = Math.max(Number(survey.roofWidthM)   || Number(project.blueprintRoofWidthM)  || 8,  1);

  const availW = SVG_W - 2 * MARGIN;
  const availH = SVG_H - 2 * MARGIN - 60; // bottom strip for labels
  const scale  = Math.min(availW / roofLM, availH / roofWM);

  const roofPxW = roofLM * scale;
  const roofPxH = roofWM * scale;
  const roofX   = MARGIN + (availW - roofPxW) / 2;
  const roofY   = MARGIN + (availH - roofPxH) / 2;

  // Setback and walkway
  const sbPx = (project.roofEdgeSetbackM || 0.3) * scale;
  const wkPx = (project.roofWalkwayAllowanceM || 0.6) * scale;
  const usX  = roofX + sbPx, usY = roofY + sbPx;
  const usW  = Math.max(0, roofPxW - 2 * sbPx);
  const usH  = Math.max(0, roofPxH - 2 * sbPx - wkPx);

  // Panel pixels
  const orient  = panelLayout.recommendedPanelOrientation || "portrait";
  const pLM  = project.panelLengthM  || 2.28;
  const pWM  = project.panelWidthM   || 1.13;
  const [pLPx, pWPx] = orient === "landscape" ? [pWM * scale, pLM * scale] : [pLM * scale, pWM * scale];
  const GAP   = Math.max(1, scale * 0.04);
  const COLS  = usW > 0 ? Math.floor(usW / (pLPx + GAP)) : 0;
  const ROWS  = usH > 0 ? Math.floor(usH / (pWPx + GAP)) : 0;
  const required = sizing.panels || 0;

  // Obstruction rects in px
  const obsPx = (simulation.obstructions || []).map(ob => ({
    x: roofX + (ob.xPct / 100) * roofPxW,
    y: roofY + (ob.yPct / 100) * roofPxH,
    w: (ob.wPct / 100) * roofPxW,
    h: (ob.hPct / 100) * roofPxH,
    label: ob.label,
  }));

  const overlaps = (px, py, pw, ph) =>
    obsPx.some(ob => px < ob.x + ob.w && px + pw > ob.x && py < ob.y + ob.h && py + ph > ob.y);

  // ── Manual layout mode (v8.6): click/arrow-select a grid cell, toggle it removed ──
  const isManual = simulation.layoutMode === "assisted_manual";
  const removedSet = new Set(
    (simulation.manualRemovedPanels || [])
      .filter(p => p.roofFaceId === PRIMARY_FACE_KEY)
      .map(p => `${p.col},${p.row}`)
  );
  const selKeyPrefix = `${PRIMARY_FACE_KEY}:`;
  const hasSelection = (simulation.selectedPanelKey || "").startsWith(selKeyPrefix);
  const [selCol, selRow] = hasSelection
    ? simulation.selectedPanelKey.slice(selKeyPrefix.length).split(":").map(Number)
    : [null, null];

  // String-colour lookup: position in the required-panel sequence -> string index
  const stringIndexByOrder = [];
  (stringPlan?.strings || []).forEach((s, idx) => {
    for (let k = 0; k < (s.panelCount || 0); k++) stringIndexByOrder.push(idx);
  });

  // Build panel grid, respecting obstructions
  const panelRects = [];
  let autoIdx = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const px = usX + col * (pLPx + GAP);
      const py = usY + row * (pWPx + GAP);
      if (overlaps(px, py, pLPx, pWPx)) continue;
      const autoPlaced = autoIdx < required;
      const order = autoIdx;
      if (autoPlaced) autoIdx++;
      const removed = isManual && removedSet.has(`${col},${row}`);
      panelRects.push({
        x: px, y: py, w: pLPx, h: pWPx, col, row, autoPlaced, removed,
        placed: autoPlaced && !removed,
        colourIdx: autoPlaced ? stringIndexByOrder[order] : undefined,
      });
    }
  }
  const placedCount = panelRects.filter(p => p.placed).length;
  const notFitted = required - placedCount;

  const selectPanel = (col, row) => {
    if (!isManual || !setSimulation) return;
    const key = `${selKeyPrefix}${col}:${row}`;
    setSimulation(s => ({ ...s, selectedPanelKey: s.selectedPanelKey === key ? null : key }));
  };

  const moveSelection = (dx, dy) => {
    if (!setSimulation || COLS <= 0 || ROWS <= 0) return;
    const nextCol = Math.min(Math.max((selCol ?? 0) + dx, 0), COLS - 1);
    const nextRow = Math.min(Math.max((selRow ?? 0) + dy, 0), ROWS - 1);
    setSimulation(s => ({ ...s, selectedPanelKey: `${selKeyPrefix}${nextCol}:${nextRow}` }));
  };

  const clearSelection = () => setSimulation && setSimulation(s => ({ ...s, selectedPanelKey: null }));

  const toggleSelected = () => {
    if (!setSimulation || selCol === null || selRow === null) return;
    const cell = panelRects.find(p => p.col === selCol && p.row === selRow);
    if (!cell) return; // obstruction or outside the placeable grid — nothing to toggle
    setSimulation(s => {
      const list = s.manualRemovedPanels || [];
      const idx = list.findIndex(p => p.roofFaceId === PRIMARY_FACE_KEY && p.col === selCol && p.row === selRow);
      if (idx >= 0) return { ...s, manualRemovedPanels: list.filter((_, i) => i !== idx) }; // restore
      if (!cell.autoPlaced) return s; // nothing installed here to remove
      return { ...s, manualRemovedPanels: [...list, { roofFaceId: PRIMARY_FACE_KEY, col: selCol, row: selRow }] };
    });
  };

  const handleGridKeyDown = (e) => {
    if (!isManual) return;
    if (e.key === "ArrowUp")    { e.preventDefault(); moveSelection(0, -1); }
    else if (e.key === "ArrowDown")  { e.preventDefault(); moveSelection(0, 1); }
    else if (e.key === "ArrowLeft")  { e.preventDefault(); moveSelection(-1, 0); }
    else if (e.key === "ArrowRight") { e.preventDefault(); moveSelection(1, 0); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSelected(); }
    else if (e.key === "Escape") { e.preventDefault(); clearSelection(); }
  };

  // Cable entry marker on roof edge
  const entry = simulation.cableEntryPoint || "bottom";
  const cableX = entry === "left"  ? roofX
               : entry === "right" ? roofX + roofPxW
               : roofX + roofPxW / 2; // bottom or top
  const cableY = entry === "top"   ? roofY
               : entry === "left" || entry === "right" ? roofY + roofPxH / 2
               : roofY + roofPxH;

  // Equipment markers (in the bottom strip, under the roof)
  const stripY  = roofY + roofPxH + 28;
  const equipItems = [
    { abbr: "INV", label: "Inverter",  color: "#6366f1", x: roofX + roofPxW * 0.20 },
    { abbr: "BAT", label: "Battery",   color: "#10b981", x: roofX + roofPxW * 0.45 },
    { abbr: "DB",  label: "DB Panel",  color: "#f59e0b", x: roofX + roofPxW * 0.70 },
    { abbr: "M",   label: "Meter",     color: "#64748b", x: roofX + roofPxW * 0.92 },
  ];

  // Orientation azimuth for north arrow rotation
  const azRad  = ((roofGeometry.roofAzimuthEstimatedDeg || 180) - 180) * (Math.PI / 180);
  const arrowX = roofX + roofPxW - 22, arrowY = roofY + 22;

  const selectedCell  = selCol !== null ? panelRects.find(p => p.col === selCol && p.row === selRow) : null;
  const selectedIsRemoved = selCol !== null && removedSet.has(`${selCol},${selRow}`);

  return (
    <div>
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%"
      style={{ maxWidth: "720px", border: "1px solid #e2e8f0", borderRadius: "10px", background: "#f1f5f9", display: "block" }}>

      {/* Roof fill */}
      <rect x={roofX} y={roofY} width={roofPxW} height={roofPxH} fill="#dbeafe" stroke="#334155" strokeWidth="2" rx="3" />

      {/* Usable area boundary */}
      <rect x={usX} y={usY} width={Math.max(0, usW)} height={Math.max(0, usH)}
        fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="5,3" opacity="0.8" />
      <text x={usX + 3} y={usY - 4} fontSize="9" fill="#059669">Usable zone</text>

      {/* Panel grid: placed (coloured by string when available), removed, or empty capacity */}
      {panelRects.map((p) => {
        const isSelected = isManual && selCol === p.col && selRow === p.row;
        let fill = "none", stroke = "#94a3b8", strokeWidth = "0.5", opacity = "0.4";
        if (p.removed) {
          fill = "#fee2e2"; stroke = "#ef4444"; strokeWidth = "1"; opacity = "0.85";
        } else if (p.placed) {
          fill = p.colourIdx !== undefined ? getStringColour(p.colourIdx) : "#10b981";
          stroke = "#065f46"; strokeWidth = "0.5"; opacity = "0.85";
        }
        return (
          <g key={`c${p.col}-${p.row}`} onClick={() => selectPanel(p.col, p.row)} style={{ cursor: isManual ? "pointer" : "default" }}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={fill} stroke={stroke} strokeWidth={strokeWidth} rx="1" opacity={opacity} />
            {p.removed && <line x1={p.x} y1={p.y} x2={p.x + p.w} y2={p.y + p.h} stroke="#ef4444" strokeWidth="1" />}
            {p.removed && <line x1={p.x + p.w} y1={p.y} x2={p.x} y2={p.y + p.h} stroke="#ef4444" strokeWidth="1" />}
            {isSelected && (
              <rect x={p.x - 1.5} y={p.y - 1.5} width={p.w + 3} height={p.h + 3}
                fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="3,2" rx="2" />
            )}
          </g>
        );
      })}

      {/* Panel count annotation */}
      {required > 0 && (
        <text x={roofX + 4} y={roofY + roofPxH - 5} fontSize="10" fill="#065f46" fontWeight="700">
          {placedCount}/{required} panels · {orient}
          {notFitted > 0 ? `  ⚠ ${notFitted} not fitted` : ""}
        </text>
      )}

      {/* Obstructions */}
      {obsPx.map((ob, i) => (
        <g key={`ob${i}`}>
          <rect x={ob.x} y={ob.y} width={ob.w} height={ob.h} fill="#fef3c7" stroke="#d97706" strokeWidth="1.5" rx="2" opacity="0.9" />
          <text x={ob.x + ob.w / 2} y={ob.y + ob.h / 2 + 4} textAnchor="middle" fontSize="9" fill="#92400e" fontWeight="600">{ob.label}</text>
        </g>
      ))}

      {/* Cable entry marker */}
      <circle cx={cableX} cy={cableY} r="7" fill="#3b82f6" stroke="#1e40af" strokeWidth="1.5" />
      <text x={cableX} y={cableY - 11} textAnchor="middle" fontSize="9" fill="#1e40af" fontWeight="600">Cable exit</text>

      {/* Cable route lines to equipment */}
      {equipItems.map((eq, i) => (
        <line key={`l${i}`} x1={cableX} y1={cableY} x2={eq.x} y2={stripY}
          stroke={eq.color} strokeWidth="1.5" strokeDasharray="6,3" opacity="0.65" />
      ))}

      {/* Equipment markers */}
      {equipItems.map((eq, i) => (
        <g key={`eq${i}`}>
          <circle cx={eq.x} cy={stripY} r="11" fill={eq.color} stroke="#fff" strokeWidth="2" />
          <text x={eq.x} y={stripY + 4} textAnchor="middle" fontSize="8.5" fill="#fff" fontWeight="800">{eq.abbr}</text>
          <text x={eq.x} y={stripY + 20} textAnchor="middle" fontSize="8" fill={eq.color} fontWeight="600">{eq.label}</text>
        </g>
      ))}

      {/* North arrow */}
      <g transform={`translate(${arrowX},${arrowY}) rotate(${(roofGeometry.roofAzimuthEstimatedDeg || 0) - 180})`}>
        <line x1="0" y1="13" x2="0" y2="-13" stroke="#0f172a" strokeWidth="2" />
        <polygon points="0,-13 -4,-3 4,-3" fill="#0f172a" />
        <text y="23" textAnchor="middle" fontSize="10" fill="#0f172a" fontWeight="800">N</text>
      </g>

      {/* Roof dimension label */}
      <text x={roofX + roofPxW / 2} y={roofY - 8} textAnchor="middle" fontSize="11" fill="#475569" fontWeight="600">
        {roofLM} m × {roofWM} m · pitch {roofGeometry.roofPitchDeg || survey.roofPitch || 15}° · {roofGeometry.roofOrientationLabel || survey.orientation || "—"}
      </text>

      {/* Not-fitted warning */}
      {notFitted > 0 && (
        <text x={SVG_W / 2} y={SVG_H - 5} textAnchor="middle" fontSize="11" fill="#ef4444" fontWeight="700">
          ⚠ {notFitted} panel(s) cannot fit — alternative mounting area needed
        </text>
      )}
    </svg>

    {setSimulation && (
      <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Layout mode:</span>
        {[["auto", "Auto"], ["assisted_manual", "Assisted Manual"]].map(([m, lbl]) => (
          <button key={m}
            onClick={() => setSimulation(s => ({ ...s, layoutMode: m, selectedPanelKey: m === "auto" ? null : s.selectedPanelKey }))}
            style={{ padding: "0.3rem 0.75rem", borderRadius: "0.35rem", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
              border: "none", background: simulation.layoutMode === m ? "var(--color-primary)" : "#f1f5f9",
              color: simulation.layoutMode === m ? "#fff" : "#475569" }}>
            {lbl}
          </button>
        ))}
      </div>
    )}

    {isManual && setSimulation && (
      <div tabIndex={0} onKeyDown={handleGridKeyDown}
        style={{ marginTop: "0.6rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center",
          background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "0.75rem", outline: "none" }}>
        <div style={{ display: "grid", gridTemplateColumns: "32px 32px 32px", gridTemplateRows: "32px 32px 32px", gap: "2px", flexShrink: 0 }}>
          <div /><button onClick={() => moveSelection(0, -1)} style={arrowPadBtnStyle} title="Move up (↑)">▲</button><div />
          <button onClick={() => moveSelection(-1, 0)} style={arrowPadBtnStyle} title="Move left (←)">◀</button>
          <button onClick={toggleSelected} style={{ ...arrowPadBtnStyle, background: "#0f172a", color: "#fff" }} title="Toggle remove/restore (Enter)">⏺</button>
          <button onClick={() => moveSelection(1, 0)} style={arrowPadBtnStyle} title="Move right (→)">▶</button>
          <div /><button onClick={() => moveSelection(0, 1)} style={arrowPadBtnStyle} title="Move down (↓)">▼</button><div />
        </div>
        <div style={{ fontSize: "0.8rem", color: "#475569", lineHeight: 1.5, minWidth: "220px" }}>
          {selCol !== null ? (
            <>
              <div><strong>Selected:</strong> Row {selRow + 1}, Col {selCol + 1}</div>
              <div>
                {!selectedCell ? "No panel here (obstruction or outside grid)."
                  : selectedIsRemoved ? "Marked removed — press ⏺ to restore."
                  : selectedCell.autoPlaced ? "Installed — press ⏺ to remove."
                  : "Empty capacity slot — nothing to remove."}
              </div>
            </>
          ) : (
            <div>Click a panel above, or use the arrows, to select a position. Click the canvas first so arrow keys move the selection instead of the page.</div>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.4rem", marginLeft: "auto" }}>
          <button onClick={clearSelection} style={{ fontSize: "0.78rem", padding: "0.3rem 0.7rem", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "0.35rem", cursor: "pointer", color: "#475569" }}>
            Clear selection
          </button>
          {removedSet.size > 0 && (
            <button
              onClick={() => setSimulation(s => ({ ...s, manualRemovedPanels: (s.manualRemovedPanels || []).filter(p => p.roofFaceId !== PRIMARY_FACE_KEY) }))}
              style={{ fontSize: "0.78rem", padding: "0.3rem 0.7rem", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "0.35rem", cursor: "pointer", color: "#7f1d1d" }}>
              Restore all ({removedSet.size})
            </button>
          )}
        </div>
      </div>
    )}

    {stringIndexByOrder.length > 0 && (
      <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.7rem", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Strings:</span>
        {(stringPlan?.strings || []).map((s, i) => (
          <span key={s.id || i} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.76rem", color: "#475569" }}>
            <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: getStringColour(i), display: "inline-block", border: "1px solid rgba(0,0,0,0.15)" }} />
            {s.label || `String ${i + 1}`}
          </span>
        ))}
      </div>
    )}
    </div>
  );
}

function SimBadge({ level, children }) {
  const s = { danger: ["#fef2f2","#fca5a5","#7f1d1d","⛔"], warning: ["#fffbeb","#fcd34d","#78350f","⚠"], info: ["#eff6ff","#93c5fd","#1e40af","ℹ"], success: ["#f0fdf4","#86efac","#14532d","✓"] }[level] || ["#f8fafc","#e2e8f0","#475569","•"];
  return (
    <div style={{ background: s[0], border: `1px solid ${s[1]}`, color: s[2], borderRadius: "0.5rem", padding: "0.5rem 0.85rem", marginBottom: "0.4rem", fontSize: "0.81rem" }}>
      {s[3]} {children}
    </div>
  );
}

function InstallerSimulation({ project, setProject, survey, sizing, simulation, setSimulation, roofGeometry, panelLayout, simWarnings, multiRoofDist, activeFaces, liveStringPlan, asBuiltIssues, showToast }) {
  const [simTab, setSimTab] = useState("layout");
  const setS = (k, v) => setSimulation(s => ({ ...s, [k]: v }));
  const setAsBuilt = (k, v) => setSimulation(s => ({ ...s, asBuilt: { ...(s.asBuilt || {}), [k]: v } }));

  // Derived helpers
  const invAdvice   = useMemo(() => getInverterAdvice(simulation, project, sizing),      [simulation, project, sizing]);
  const batAdvice   = useMemo(() => getBatteryAdvice(simulation, project),               [simulation, project]);
  const cableData   = useMemo(() => getCableEstimates(simulation, project, roofGeometry), [simulation, project, roofGeometry]);
  const steps       = useMemo(() => getInstallationSteps(), []);
  const bpGuidance  = useMemo(() => project.sizingMode === "blueprint_new_build" ? getBlueprintSimulationGuidance() : [], [project.sizingMode]);

  const OBSTRUCTION_TYPES = ["Water tank", "Chimney", "Skylight", "Roof hatch", "Tree shade zone", "Satellite dish", "AC outdoor unit", "Other"];

  const addObstruction = (type) => {
    setSimulation(s => ({
      ...s,
      obstructions: [...s.obstructions, { id: Date.now(), label: type, xPct: 30 + s.obstructions.length * 5, yPct: 20, wPct: 12, hPct: 12 }],
    }));
  };
  const removeObstruction = (id) => setSimulation(s => ({ ...s, obstructions: s.obstructions.filter(o => o.id !== id) }));
  const updateObstruction = (id, k, v) => setSimulation(s => ({ ...s, obstructions: s.obstructions.map(o => o.id === id ? { ...o, [k]: v } : o) }));
  const toggleStep = (i) => setSimulation(s => { const c = [...s.installationChecklist]; c[i] = !c[i]; return { ...s, installationChecklist: c }; });

  const dangerCount = simWarnings.filter(w => w.level === "danger").length;
  const warnCount   = simWarnings.filter(w => w.level === "warning").length;
  const completedSteps = simulation.installationChecklist.filter(Boolean).length;

  const asBuiltDanger = asBuiltIssues.filter(i => i.level === "danger").length;
  const TABS = [
    { id: "layout",    label: "📐 Roof Layout" },
    { id: "multiroof", label: `🏠 Multi-Roof (${activeFaces.length})` },
    { id: "strings",   label: `⚡ Strings (${liveStringPlan.totalStrings || 0})` },
    { id: "equipment", label: "🔧 Equipment" },
    { id: "cables",    label: "🔌 Cables" },
    { id: "asbuilt",   label: `📋 As-Built${asBuiltDanger > 0 ? ` ⚠${asBuiltDanger}` : ""}` },
    { id: "sequence",  label: `✅ Sequence (${completedSteps}/${steps.length})` },
    { id: "warnings",  label: `⚠ Warnings (${dangerCount + warnCount})` },
  ];

  const tabBtnStyle = (id) => ({
    padding: "0.45rem 0.9rem", borderRadius: "0.4rem", fontWeight: 600, fontSize: "0.82rem",
    cursor: "pointer", border: "none",
    background: simTab === id ? "var(--color-primary)" : "#f1f5f9",
    color: simTab === id ? "#fff" : "#475569",
    transition: "all 0.15s",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0f172a, #1e3a8a)", borderRadius: "0.75rem", padding: "1rem 1.25rem", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#93c5fd", marginBottom: "0.2rem" }}>Solarise Pro powered by Voltflow</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 800 }}>Installer Simulation Studio</div>
          </div>
          <button
            onClick={() => setS("technicianView", !simulation.technicianView)}
            style={{ padding: "0.4rem 0.9rem", borderRadius: "0.4rem", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", border: "1.5px solid rgba(255,255,255,0.3)", background: simulation.technicianView ? "#10b981" : "rgba(255,255,255,0.1)", color: "#fff" }}>
            {simulation.technicianView ? "🔧 Technician View ON" : "👤 Switch to Technician View"}
          </button>
        </div>
        <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.25rem" }}>
          Planning guide for technicians — not a substitute for site-specific structural, wind loading, or licensed engineering review.
        </div>
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.82rem" }}>
          <span style={{ background: "rgba(255,255,255,0.1)", padding: "0.2rem 0.6rem", borderRadius: "0.35rem" }}>
            {sizing.panels || 0} panels · {num(sizing.actualKwp, 1)} kWp
          </span>
          <span style={{ background: panelLayout.roofFitStatus?.startsWith("Fits comfortably") ? "rgba(16,185,129,0.2)" : panelLayout.roofFitStatus?.startsWith("Does not") ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)", padding: "0.2rem 0.6rem", borderRadius: "0.35rem" }}>
            🏠 {panelLayout.roofFitStatus?.split("—")[0]?.trim() || "Roof: not assessed"}
          </span>
          {dangerCount > 0 && (
            <span style={{ background: "rgba(239,68,68,0.25)", padding: "0.2rem 0.6rem", borderRadius: "0.35rem", color: "#fca5a5", fontWeight: 700 }}>
              ⛔ {dangerCount} critical warning(s)
            </span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        {TABS.map(t => <button key={t.id} style={tabBtnStyle(t.id)} onClick={() => setSimTab(t.id)}>{t.label}</button>)}
      </div>

      {/* ── LAYOUT TAB ── */}
      {simTab === "layout" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Card title="2D Roof Layout" subtitle="Automatic placement, coloured by string. Switch to Assisted Manual to fine-tune individual panels.">
            <RoofCanvas project={project} survey={survey} sizing={sizing} simulation={simulation}
              panelLayout={panelLayout} roofGeometry={roofGeometry} setSimulation={setSimulation} stringPlan={liveStringPlan} />
            <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Panel orientation:</span>
              {["portrait", "landscape", "auto"].map(o => (
                <button key={o} onClick={() => setProject(p => ({ ...p, mountingOrientation: o }))}
                  style={{ padding: "0.3rem 0.75rem", borderRadius: "0.35rem", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                    border: "none", background: project.mountingOrientation === o ? "var(--color-primary)" : "#f1f5f9",
                    color: project.mountingOrientation === o ? "#fff" : "#475569" }}>
                  {o}
                </button>
              ))}
              <span style={{ marginLeft: "0.75rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>Cable exit:</span>
              {["bottom", "left", "right", "top"].map(e => (
                <button key={e} onClick={() => setS("cableEntryPoint", e)}
                  style={{ padding: "0.3rem 0.75rem", borderRadius: "0.35rem", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                    border: "none", background: simulation.cableEntryPoint === e ? "#3b82f6" : "#f1f5f9",
                    color: simulation.cableEntryPoint === e ? "#fff" : "#475569" }}>
                  {e}
                </button>
              ))}
            </div>
          </Card>

          <Card title="Obstructions" subtitle="Mark physical obstructions on the roof. They are excluded from panel placement.">
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              {OBSTRUCTION_TYPES.map(t => (
                <button key={t} onClick={() => addObstruction(t)}
                  style={{ padding: "0.3rem 0.7rem", borderRadius: "1rem", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569" }}>
                  + {t}
                </button>
              ))}
            </div>
            {simulation.obstructions.length === 0 && (
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontStyle: "italic" }}>No obstructions added. Click above to add any roof obstructions.</div>
            )}
            {simulation.obstructions.map(ob => (
              <div key={ob.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 80px 80px auto", gap: "0.4rem", alignItems: "center", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "0.4rem", padding: "0.5rem 0.75rem", marginBottom: "0.4rem", fontSize: "0.8rem" }}>
                <strong style={{ color: "#92400e" }}>{ob.label}</strong>
                {[["x%", "xPct"], ["y%", "yPct"], ["w%", "wPct"], ["h%", "hPct"]].map(([lbl, key]) => (
                  <div key={key} style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "0.68rem", color: "#64748b" }}>{lbl}</span>
                    <input type="number" min="1" max="90" value={ob[key]}
                      onChange={e => updateObstruction(ob.id, key, Number(e.target.value))}
                      style={{ width: "70px", padding: "0.2rem 0.4rem", border: "1px solid #e2e8f0", borderRadius: "0.3rem", fontSize: "0.8rem" }} />
                  </div>
                ))}
                <button onClick={() => removeObstruction(ob.id)} style={{ padding: "0.25rem 0.6rem", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "0.35rem", color: "#7f1d1d", cursor: "pointer", fontSize: "0.78rem" }}>✕ Remove</button>
              </div>
            ))}
            <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
              x/y = position from roof top-left corner as % of roof dimensions. w/h = obstruction size as % of roof.
            </div>
          </Card>

          {bpGuidance.length > 0 && (
            <Card title="Blueprint / Construction Stage Guidance" subtitle="Applicable because sizing mode is set to Blueprint / New Build.">
              <ul style={{ paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                {bpGuidance.map((tip, i) => <li key={i} style={{ fontSize: "0.82rem", color: "#1e3a8a", lineHeight: 1.5 }}>{tip}</li>)}
              </ul>
            </Card>
          )}
        </div>
      )}

      {/* ── EQUIPMENT TAB ── */}
      {simTab === "equipment" && (
        <div className="grid-cols-2">
          <Card title="Inverter placement" subtitle="">
            <SelectField label="Inverter Location"
              value={simulation.inverterLocation}
              onChange={v => setS("inverterLocation", v)}
              options={[
                { value: "indoor_utility", label: "Indoor — utility/store room" },
                { value: "garage",         label: "Garage" },
                { value: "corridor",       label: "Corridor / passage" },
                { value: "outside_shaded", label: "Outside — shaded wall" },
                { value: "outside_unshaded", label: "Outside — exposed (not recommended)" },
                { value: "custom",         label: "Custom / other" },
              ]} />
            <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {invAdvice.map((a, i) => <SimBadge key={i} level={a.level}>{a.msg}</SimBadge>)}
            </div>
          </Card>

          <Card title="Battery placement" subtitle="">
            <SelectField label="Battery Location"
              value={simulation.batteryLocation}
              onChange={v => setS("batteryLocation", v)}
              options={[
                { value: "near_inverter", label: "Near inverter (recommended)" },
                { value: "utility_room",  label: "Utility / store room" },
                { value: "garage",        label: "Garage" },
                { value: "outside",       label: "Outside — with weather enclosure" },
                { value: "bedroom",       label: "Bedroom (not recommended)" },
                { value: "custom",        label: "Custom / other" },
              ]} />
            <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {batAdvice.map((a, i) => <SimBadge key={i} level={a.level}>{a.msg}</SimBadge>)}
            </div>
          </Card>

          <Card title="DB / meter locations" subtitle="">
            <SelectField label="DB Location" value={simulation.dbLocation}
              onChange={v => setS("dbLocation", v)}
              options={[
                { value: "bottom-left",  label: "Bottom-left of building" },
                { value: "bottom-right", label: "Bottom-right of building" },
                { value: "top-left",     label: "Top-left of building" },
                { value: "top-right",    label: "Top-right of building" },
                { value: "custom",       label: "Custom" },
              ]} />
            <SelectField label="Meter Location" value={simulation.meterLocation}
              onChange={v => setS("meterLocation", v)}
              options={[
                { value: "front_wall",  label: "Front wall / main entrance" },
                { value: "near_db",     label: "Near DB panel" },
                { value: "garage",      label: "Garage" },
                { value: "custom",      label: "Custom" },
              ]} />
            <SimBadge level="info">Minimize AC cable distance between inverter and DB where possible for lower voltage drop and cleaner wiring.</SimBadge>
          </Card>

          <Card title="Roof dimensions for layout" subtitle="Adjust if different from survey inputs.">
            <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <Field disabled={!!project.equipmentSelection?.enabled} label="Panel Length (m)" type="number" step="0.01" value={project.panelLengthM} onChange={v => setProject(p => ({ ...p, panelLengthM: v }))} />
              <Field disabled={!!project.equipmentSelection?.enabled} label="Panel Width (m)"  type="number" step="0.01" value={project.panelWidthM}  onChange={v => setProject(p => ({ ...p, panelWidthM: v }))} />
              <Field label="Edge Setback (m)" type="number" step="0.1"  value={project.roofEdgeSetbackM} onChange={v => setProject(p => ({ ...p, roofEdgeSetbackM: v }))} help="Edge clearance" />
              <Field label="Walkway (m)"      type="number" step="0.1"  value={project.roofWalkwayAllowanceM} onChange={v => setProject(p => ({ ...p, roofWalkwayAllowanceM: v }))} help="Maintenance walkway" />
            </div>
          </Card>
        </div>
      )}

      {/* ── CABLES TAB ── */}
      {simTab === "cables" && (
        <div className="grid-cols-2">
          <Card title="Cable route estimates" subtitle="Leave at 0 to use automatic estimates based on equipment positions.">
            <div className="form-grid">
              <Field label="DC route length (m)"      type="number" value={simulation.dcRouteCustomM}      onChange={v => setS("dcRouteCustomM", v)}      help="0 = auto-estimate" />
              <Field label="AC route length (m)"      type="number" value={simulation.acRouteCustomM}      onChange={v => setS("acRouteCustomM", v)}      help="Inverter → DB" />
              <Field label="Battery cable route (m)"  type="number" value={simulation.batteryRouteCustomM} onChange={v => setS("batteryRouteCustomM", v)} help="Inverter → battery" />
            </div>
            <div style={{ background: "#f8fafc", borderRadius: "0.5rem", padding: "0.75rem", marginTop: "0.75rem" }}>
              <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.4rem" }}>Estimated route lengths</div>
              {[["DC route (panels → inverter)", `${cableData.dcM} m`], ["AC route (inverter → DB)", `${cableData.acM} m`], ["Battery cable (inverter ↔ battery)", `${cableData.batM} m`]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "0.3rem 0", borderBottom: "1px solid #f1f5f9", fontSize: "0.82rem" }}>
                  <span style={{ color: "#64748b" }}>{k}</span>
                  <span style={{ fontWeight: 700 }}>{v}</span>
                </div>
              ))}
            </div>
            {/* v11.1 — push simulation estimates into the project cable lengths that
                drive voltage-drop and compliance. Explicit button, never silent. */}
            <div style={{ marginTop: "0.75rem", padding: "0.6rem 0.85rem", background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: "0.5rem" }}>
              <div style={{ fontSize: "0.78rem", color: "#1e3a8a", marginBottom: "0.5rem" }}>
                Project cable lengths used by voltage-drop checks: DC <strong>{project.dcCableLengthM} m</strong>, AC <strong>{project.acCableLengthM} m</strong>.
                Simulation estimates: DC <strong>{cableData.dcM} m</strong>, AC <strong>{cableData.acM} m</strong>.
              </div>
              <button
                className="btn btn-primary"
                style={{ fontSize: "0.8rem" }}
                disabled={project.dcCableLengthM === Math.ceil(cableData.dcM) && project.acCableLengthM === Math.ceil(cableData.acM)}
                onClick={() => {
                  setProject(p => ({ ...p, dcCableLengthM: Math.ceil(cableData.dcM), acCableLengthM: Math.ceil(cableData.acM) }));
                  if (showToast) showToast(`Project cable lengths updated from simulation (DC ${Math.ceil(cableData.dcM)} m, AC ${Math.ceil(cableData.acM)} m) — voltage drop recalculated.`);
                }}>
                ⚡ Apply simulation cable lengths to project
              </button>
              {(project.dcCableLengthM === Math.ceil(cableData.dcM) && project.acCableLengthM === Math.ceil(cableData.acM)) && (
                <span style={{ marginLeft: "0.6rem", fontSize: "0.75rem", color: "#166534", fontWeight: 600 }}>✓ Already applied</span>
              )}
            </div>
          </Card>

          <Card title="Cable route advisory" subtitle="">
            {cableData.warnings.map((w, i) => <SimBadge key={i} level={w.level}>{w.msg}</SimBadge>)}
            <div style={{ marginTop: "0.75rem" }}>
              <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.5rem" }}>DC/AC voltage drop (from sizing)</div>
              <InfoRow label="DC cable drop" value={pct(sizing.dcDropPct)} />
              <InfoRow label="AC cable drop"  value={pct(sizing.acDropPct)} />
              {sizing.dcDropPct > 0.015 && <SimBadge level="warning">DC voltage drop exceeds 1.5% — increase cable CSA or shorten route.</SimBadge>}
              {sizing.acDropPct > 0.03  && <SimBadge level="warning">AC voltage drop exceeds 3.0% — increase cable CSA or shorten route.</SimBadge>}
            </div>
          </Card>
        </div>
      )}

      {/* ── SEQUENCE TAB ── */}
      {simTab === "sequence" && (
        <Card title="Suggested installation sequence"
          subtitle={`${completedSteps} of ${steps.length} steps completed. Tick items as the work progresses. This is a planning guide, not a regulatory standard.`}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {steps.map((step, i) => {
              const done = simulation.installationChecklist[i];
              return (
                <label key={step.id}
                  style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.6rem 0.85rem",
                    background: done ? "#f0fdf4" : "#fff",
                    border: `1px solid ${done ? "#86efac" : "#e2e8f0"}`,
                    borderRadius: "0.5rem", cursor: "pointer", transition: "background 0.1s" }}>
                  <input type="checkbox" checked={done} onChange={() => toggleStep(i)} style={{ marginTop: "2px", accentColor: "#10b981", flexShrink: 0 }} />
                  <div>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b", marginRight: "0.5rem" }}>{step.id}.</span>
                    <span style={{ fontSize: "0.83rem", color: done ? "#166534" : "#0f172a", fontWeight: done ? 600 : 400, textDecoration: done ? "none" : "none" }}>{step.label}</span>
                  </div>
                </label>
              );
            })}
          </div>
          <div style={{ marginTop: "0.75rem", padding: "0.6rem 1rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.78rem", color: "#64748b" }}>
            ⚠ This sequence is a practical planning guide only. Local regulations, utility requirements (KPLC/EPRA), and manufacturer instructions take precedence over this checklist.
          </div>
          <div style={{ marginTop: "0.5rem" }}>
            <button onClick={() => setSimulation(s => ({ ...s, installationChecklist: Array(19).fill(false) }))}
              style={{ fontSize: "0.78rem", padding: "0.3rem 0.75rem", background: "#f1f5f9", border: "none", borderRadius: "0.35rem", cursor: "pointer", color: "#475569" }}>
              Reset all
            </button>
          </div>
        </Card>
      )}

      {/* ── WARNINGS TAB ── */}
      {simTab === "warnings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Card title="Installer simulation warnings" subtitle="Address all danger-level items before commencing installation.">
            {simWarnings.length === 0 && (
              <SimBadge level="success">No warnings generated for the current configuration.</SimBadge>
            )}
            {simWarnings.map((w, i) => <SimBadge key={i} level={w.level}>{w.msg}</SimBadge>)}
          </Card>
          <Card title="General installer guidance" subtitle="Always applicable — regardless of specific warnings above.">
            {[
              { level: "info", msg: "Installer simulation is a technician planning guide only. Final installation layout must be verified on site." },
              { level: "info", msg: "Obtain any required KPLC notification and EPRA generation exemption before grid connection." },
              { level: "info", msg: "Complete a risk assessment and method statement before starting roof work." },
              { level: "info", msg: "All wiring must be done by a licensed electrician. PV system commissioning must follow IEC 62446." },
              { level: "info", msg: "Issue the client with a system handover pack including SLD, warranty cards, monitoring app setup, and emergency shutdown procedure." },
            ].map((w, i) => <SimBadge key={i} level={w.level}>{w.msg}</SimBadge>)}
          </Card>
        </div>
      )}

      {/* ── MULTI-ROOF TAB ── */}
      {simTab === "multiroof" && (
        <MultiRoofTab
          activeFaces={activeFaces}
          simulation={simulation}
          setSimulation={setSimulation}
          project={project}
          sizing={sizing}
          survey={survey}
          multiRoofDist={multiRoofDist}
        />
      )}

      {/* ── STRINGS TAB ── */}
      {simTab === "strings" && (
        <StringPlanTab
          liveStringPlan={liveStringPlan}
          project={project}
          setProject={setProject}
          sizing={sizing}
          simulation={simulation}
          setSimulation={setSimulation}
          activeFaces={activeFaces}
          showToast={showToast}
        />
      )}

      {/* ── AS-BUILT TAB ── */}
      {simTab === "asbuilt" && (
        <AsBuiltTab
          simulation={simulation}
          setSimulation={setSimulation}
          setAsBuilt={setAsBuilt}
          liveStringPlan={liveStringPlan}
          asBuiltIssues={asBuiltIssues}
          sizing={sizing}
          showToast={showToast}
        />
      )}

      {/* ── TECHNICIAN VIEW ── */}
      {simulation.technicianView && (
        <TechnicianView
          project={project}
          sizing={sizing}
          simulation={simulation}
          liveStringPlan={liveStringPlan}
          simWarnings={simWarnings}
          panelLayout={panelLayout}
          multiRoofDist={multiRoofDist}
          steps={steps}
        />
      )}
    </div>
  );
}

/* ─── MULTI-ROOF TAB ─────────────────────────────────────────────────── */

function MultiRoofTab({ activeFaces, simulation, setSimulation, project, sizing, survey, multiRoofDist }) {
  const addFace = () => {
    const newFace = createDefaultRoofFace("", survey);
    setSimulation(s => ({ ...s, roofFaces: [...(s.roofFaces.length > 0 ? s.roofFaces : initRoofFacesFromSurvey(survey, project)), newFace] }));
  };
  const ensureFaces = (fn) => {
    setSimulation(s => {
      const faces = s.roofFaces.length > 0 ? s.roofFaces : initRoofFacesFromSurvey(survey, project);
      return { ...s, roofFaces: fn(faces) };
    });
  };
  const updateFace = (id, k, v) => ensureFaces(f => f.map(x => {
    if (x.id !== id) return x;
    const next = { ...x, [k]: v };
    if (k === "label" || k === "name") { next.label = v; next.name = v; }
    if (k === "azimuth_deg" || k === "roofAzimuthDeg") { next.azimuth_deg = v; next.roofAzimuthDeg = v; }
    if (k === "tilt_deg" || k === "roofPitchDeg") { next.tilt_deg = v; next.roofPitchDeg = v; }
    if (k === "selected_for_pv" || k === "selectedForPv") { next.selected_for_pv = !!v; next.selectedForPv = !!v; }
    if (k === "usable_area_m2") {
      next.roofUsablePercent = Number(next.gross_area_m2) > 0 ? Math.min(1, Number(v) / Number(next.gross_area_m2)) : 0;
    }
    if (k === "roofLengthM" || k === "roofWidthM") {
      next.gross_area_m2 = Math.max(0, Number(next.roofLengthM) || 0) * Math.max(0, Number(next.roofWidthM) || 0);
      next.usable_area_m2 = next.gross_area_m2 * Math.max(0, Math.min(1, Number(next.roofUsablePercent) || 0.7));
    }
    return normalizeRoofFace(next);
  }));
  const deleteFace = (id) => ensureFaces(f => f.filter(x => x.id !== id));
  const dupFace   = (face) => {
    const copy = { ...face, id: `face_${Date.now()}`, name: face.name + " (copy)" };
    ensureFaces(f => [...f, copy]);
  };

  const req     = sizing.panels || 0;
  const total   = multiRoofDist.totalFitted || 0;
  const notFit  = multiRoofDist.panelsNotFitted || 0;
  const fitColour = notFit === 0 ? "#10b981" : notFit < req * 0.2 ? "#f59e0b" : "#ef4444";
  const roofSummary = summarizeRoofFaces(activeFaces, project);
  const roofValidation = validateRoofFaces(activeFaces, project);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Summary bar */}
      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "0.75rem 1rem", display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <Metric label="Required panels"  value={`${req}`} />
        <Metric label="Fitted across all faces" value={`${total}`} good={notFit === 0} danger={notFit > 0} />
        <Metric label="Not fitted" value={`${notFit}`} danger={notFit > 0} />
        <Metric label="Usable roof area" value={`${num(roofSummary.total_usable_area_m2, 1)} m²`} hint={`${roofSummary.selected_faces} selected face(s)`} />
        <div style={{ fontWeight: 700, fontSize: "0.85rem", color: fitColour, marginLeft: "auto" }}>{multiRoofDist.overallFitStatus}</div>
      </div>

      {/* Per-face cards */}
      {activeFaces.map((face, idx) => {
        const dr = multiRoofDist.faceResults?.find(r => r.faceId === face.id);
        const cap = computeFaceCapacity(face, project);
        const score = getRoofFaceScore(face);
        return (
          <div key={face.id} style={{ border: "1.5px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" }}>
            {/* Face header */}
            <div style={{ background: "#f1f5f9", padding: "0.65rem 1rem", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              <input value={face.label || face.name} onChange={e => updateFace(face.id, "label", e.target.value)}
                style={{ fontWeight: 700, fontSize: "0.9rem", border: "none", background: "transparent", color: "#0f172a", outline: "none", minWidth: "120px" }} />
              <span style={{ fontSize: "0.75rem", padding: "0.15rem 0.5rem", borderRadius: "1rem", background: score > 70 ? "#dcfce7" : score > 40 ? "#fef3c7" : "#fee2e2", color: score > 70 ? "#166534" : score > 40 ? "#78350f" : "#7f1d1d", fontWeight: 700 }}>
                Score {score}/100
              </span>
              <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", cursor: "pointer" }}>
                <input type="checkbox" checked={face.selected_for_pv !== false} onChange={e => updateFace(face.id, "selected_for_pv", e.target.checked)} />
                Selected for PV
              </label>
              <div style={{ marginLeft: "auto", display: "flex", gap: "0.4rem" }}>
                <button onClick={() => dupFace(face)}    style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem", border: "1px solid #e2e8f0", borderRadius: "0.35rem", background: "#fff", cursor: "pointer" }}>⧉ Duplicate</button>
                {activeFaces.length > 1 && (
                  <button onClick={() => deleteFace(face.id)} style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem", border: "1px solid #fca5a5", borderRadius: "0.35rem", background: "#fef2f2", color: "#7f1d1d", cursor: "pointer" }}>✕ Delete</button>
                )}
              </div>
            </div>
            {/* Face body */}
            <div style={{ padding: "0.75rem 1rem", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.5rem" }}>
              {[
                ["Length (m)",  "roofLengthM",       "number"],
                ["Width (m)",   "roofWidthM",         "number"],
                ["Tilt (°)",   "tilt_deg",       "number"],
                ["Azimuth (°)", "azimuth_deg",     "number"],
              ].map(([lbl, key, type]) => (
                <div key={key} className="field-group">
                  <span className="field-label">{lbl}</span>
                  <input type={type} className="field-input" value={face[key] || 0}
                    onChange={e => updateFace(face.id, key, type === "number" ? Number(e.target.value) : e.target.value)} />
                </div>
              ))}
              <div className="field-group">
                <span className="field-label">Condition</span>
                <select className="select-input" value={face.roofCondition || "Good"} onChange={e => updateFace(face.id, "roofCondition", e.target.value)}>
                  {["Good", "Fair", "Weak", "Rusted", "Needs structural repair", "Asbestos — Do Not Proceed"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field-group">
                <span className="field-label">Usable %</span>
                <input type="number" min="10" max="100" className="field-input"
                  value={Math.round((face.roofUsablePercent || 0.7) * 100)}
                  onChange={e => updateFace(face.id, "roofUsablePercent", clamp(e.target.value, 10, 100) / 100)} />
              </div>
              <div className="field-group">
                <span className="field-label">Gross area (m²)</span>
                <input type="number" min="0" className="field-input" value={face.gross_area_m2 || 0} onChange={e => updateFace(face.id, "gross_area_m2", Math.max(0, Number(e.target.value) || 0))} />
              </div>
              <div className="field-group">
                <span className="field-label">Usable area (m²)</span>
                <input type="number" min="0" max={face.gross_area_m2 || undefined} className="field-input" value={face.usable_area_m2 || 0} onChange={e => updateFace(face.id, "usable_area_m2", Math.max(0, Number(e.target.value) || 0))} />
              </div>
              <div className="field-group">
                <span className="field-label">Shading (%)</span>
                <input type="number" min="0" max="100" className="field-input" value={face.shading_pct || 0} onChange={e => updateFace(face.id, "shading_pct", clamp(e.target.value, 0, 100))} />
              </div>
              <div className="field-group">
                <span className="field-label">MPPT assignment</span>
                <input className="field-input" value={face.mppt_assignment || ""} placeholder="Auto" onChange={e => updateFace(face.id, "mppt_assignment", e.target.value || null)} />
              </div>
              {/* Capacity summary */}
              <div style={{ gridColumn: "3 / 5", background: "#f8fafc", borderRadius: "0.4rem", padding: "0.5rem 0.75rem", fontSize: "0.8rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <span>Max panels: <strong>{cap.maxPanels}</strong></span>
                <span>Allocated: <strong>{dr?.allocated ?? "—"}</strong></span>
                <span>Usable area: <strong>{cap.usableAreaM2} m²</strong></span>
                <span>Photos: <strong>{face.photo_ids?.length || 0}</strong></span>
                <span style={{ color: (dr?.fitStatus || "").startsWith("Fits") ? "#10b981" : "#f59e0b", fontWeight: 700 }}>{dr?.fitStatus || ""}</span>
              </div>
            </div>
            {/* Per-face warnings */}
            {(dr?.warnings || []).map((w, i) => (
              <div key={i} style={{ margin: "0 1rem 0.5rem", padding: "0.35rem 0.7rem", borderRadius: "0.35rem", fontSize: "0.77rem",
                background: w.level === "danger" ? "#fef2f2" : w.level === "warning" ? "#fffbeb" : "#eff6ff",
                color:      w.level === "danger" ? "#7f1d1d" : w.level === "warning" ? "#78350f" : "#1e40af", }}>
                {w.level === "danger" ? "⛔" : w.level === "warning" ? "⚠" : "ℹ"} {w.msg}
              </div>
            ))}
          </div>
        );
      })}

      <button onClick={addFace} className="btn btn-primary" style={{ alignSelf: "flex-start" }}>+ Add Roof Face</button>

      {roofValidation.map((error) => <SimBadge key={error.id} level="danger">{error.label}: {error.problems.join(" · ")}</SimBadge>)}

      {notFit > 0 && (
        <SimBadge level="danger">
          ⛔ {notFit} panel(s) cannot fit across all selected roof faces. Consider adding a carport, ground mount, or second roof face.
        </SimBadge>
      )}
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", padding: "0.5rem" }}>
        Panel distribution prioritises roof faces with better orientation, condition and area. Faces marked "not selected for PV" or with asbestos are excluded automatically.
      </div>
    </div>
  );
}

/* ─── STRING PLAN TAB ────────────────────────────────────────────────── */

function StringPlanTab({ liveStringPlan, project, setProject, sizing, simulation, setSimulation, activeFaces, showToast }) {
  const plan = liveStringPlan;

  const regenerate = () => {
    const fresh = generateStringPlan(project, sizing, activeFaces);
    setSimulation(s => ({ ...s, stringPlan: fresh }));
    if (showToast) showToast("String plan regenerated.");
  };

  const setMppt = (stringId, mppt) => {
    if (!plan.strings) return;
    const strings = plan.strings.map(s => s.id === stringId ? { ...s, mpptNumber: mppt } : s);
    // Revalidate immediately so mixed-orientation / per-MPPT-capacity warnings
    // reflect the manual assignment without a full regenerate (v11.1).
    const updated = { ...plan, strings, panWarnings: computePlanWarnings(strings, project) };
    setSimulation(s => ({ ...s, stringPlan: updated }));
  };

  const allWarnings = [...(plan.panWarnings || []), ...(plan.strings || []).flatMap(s => s.warnings || [])];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Config */}
      <Card title="MPPT / string configuration" subtitle="Adjust MPPT count and strings per MPPT to match your inverter datasheet.">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.75rem" }}>
          <Field label="MPPT count" type="number" value={project.inverterMpptCount || 2}
            onChange={v => setProject(p => ({ ...p, inverterMpptCount: Math.max(1, Math.floor(v || 1)) }))} />
          <Field label="Strings per MPPT" type="number" value={project.inverterStringsPerMppt || 2}
            onChange={v => setProject(p => ({ ...p, inverterStringsPerMppt: Math.max(1, Math.floor(v || 1)) }))} />
          <Field disabled={!!project.equipmentSelection?.enabled} label="Panels per string" type="number" value={project.panelsPerString || 12}
            onChange={v => setProject(p => ({ ...p, panelsPerString: Math.max(1, Math.floor(v || 1)) }))} />
          <Field disabled={!!project.equipmentSelection?.enabled} label="Inverter max DC (V)" type="number" value={project.inverterMaxDcV || 1000}
            onChange={v => setProject(p => ({ ...p, inverterMaxDcV: v }))} />
        </div>
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
          <button onClick={regenerate} className="btn btn-primary">⚡ Regenerate String Plan</button>
          <button onClick={() => setSimulation(s => ({ ...s, stringPlan: null }))} className="btn btn-secondary">↺ Reset to Auto</button>
        </div>
      </Card>

      {/* Plan-level warnings */}
      {allWarnings.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {allWarnings.map((w, i) => (
            <SimBadge key={i} level={w.level || (w.includes("EXCEEDS") ? "danger" : "warning")}>{w.msg || w}</SimBadge>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="grid-cols-4">
        <Metric label="Total strings"     value={`${plan.totalStrings || 0}`} />
        <Metric label="Panels per string" value={`${plan.panelsPerString || 0}`} />
        <Metric label="MPPT inputs"       value={`${plan.mpptCount || 0}`} />
        <Metric label="Combiner needed"   value={plan.needsCombiner ? "Yes" : "No"} danger={plan.needsCombiner} />
      </div>

      {/* String table */}
      <Card title="String assignments" subtitle="Click MPPT to reassign. Colours match roof layout SVG.">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>String</th>
                <th>Colour</th>
                <th>Panels</th>
                <th>MPPT</th>
                <th>Roof face</th>
                <th>Voc cold (V)</th>
                <th>Vmp (V)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(plan.strings || []).map((s, i) => (
                <tr key={s.id} style={{ background: s.status === "warning" ? "#fffbeb" : "#fff" }}>
                  <td style={{ fontWeight: 700 }}>{s.label}</td>
                  <td>
                    <div style={{ width: "24px", height: "24px", borderRadius: "4px", background: getStringColour(i), border: "2px solid rgba(0,0,0,0.15)" }} />
                  </td>
                  <td>{s.panelCount}</td>
                  <td>
                    <select value={s.mpptNumber} onChange={e => setMppt(s.id, Number(e.target.value))}
                      style={{ padding: "0.25rem 0.5rem", border: "1px solid #e2e8f0", borderRadius: "0.3rem", fontSize: "0.8rem" }}>
                      {Array.from({ length: project.inverterMpptCount || 2 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>MPPT {i + 1}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ fontSize: "0.8rem", color: "#64748b" }}>{s.roofFaceName || "—"}</td>
                  <td style={{ fontWeight: 600, color: s.stringVocCold > (project.inverterMaxDcV || 1000) ? "#ef4444" : "#0f172a" }}>
                    {s.stringVocCold}
                  </td>
                  <td>{s.stringVmp}</td>
                  <td>
                    <span style={{ padding: "0.2rem 0.6rem", borderRadius: "1rem", fontSize: "0.72rem", fontWeight: 700,
                      background: s.status === "ok" ? "#dcfce7" : "#fef3c7",
                      color:      s.status === "ok" ? "#166534" : "#92400e" }}>
                      {s.status === "ok" ? "✓ OK" : `⚠ ${s.warnings.length} warning${s.warnings.length > 1 ? "s" : ""}`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          String plan is a planning estimate. Final string design must be verified against inverter and module datasheets, IEC 62548, and local wiring regulations.
        </div>
      </Card>
    </div>
  );
}

/* ─── AS-BUILT TAB ───────────────────────────────────────────────────── */

function AsBuiltTab({ simulation, setSimulation, setAsBuilt, liveStringPlan, asBuiltIssues, sizing, showToast }) {
  const ab = simulation.asBuilt || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", background: ab.enabled ? "#f0fdf4" : "#f8fafc", border: `1.5px solid ${ab.enabled ? "#86efac" : "#e2e8f0"}`, borderRadius: "0.5rem", padding: "0.75rem 1rem" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", fontWeight: 700, fontSize: "0.9rem" }}>
          <input type="checkbox" checked={!!ab.enabled} onChange={e => setAsBuilt("enabled", e.target.checked)} style={{ width: "18px", height: "18px", accentColor: "#10b981" }} />
          As-Built / Commissioning Mode {ab.enabled ? "ACTIVE" : "(click to activate)"}
        </label>
        <div style={{ fontSize: "0.78rem", color: "#64748b", marginLeft: "auto" }}>
          {ab.enabled ? "Record actual installation data below." : "Switch on to record commissioning measurements and handover details."}
        </div>
      </div>

      {ab.enabled && (
        <div className="grid-cols-2">
          <Card title="Actual installation data" subtitle="">
            <div className="form-grid">
              <Field label="Actual panels installed" type="number" value={ab.actualPanelsInstalled || 0} onChange={v => setAsBuilt("actualPanelsInstalled", v)} help={`Planned: ${sizing.panels || 0}`} />
              <SelectField label="Actual panel orientation" value={ab.actualPanelOrientation || "portrait"} onChange={v => setAsBuilt("actualPanelOrientation", v)} options={["portrait", "landscape"]} />
              <Field label="Actual DC cable length (m)"      type="number" value={ab.actualDcCableLengthM || 0}       onChange={v => setAsBuilt("actualDcCableLengthM", v)} />
              <Field label="Actual AC cable length (m)"      type="number" value={ab.actualAcCableLengthM || 0}       onChange={v => setAsBuilt("actualAcCableLengthM", v)} />
              <Field label="Actual battery cable length (m)" type="number" value={ab.actualBatteryCableLengthM || 0}  onChange={v => setAsBuilt("actualBatteryCableLengthM", v)} />
              <Field label="Actual inverter location" value={ab.actualInverterLocation || ""} onChange={v => setAsBuilt("actualInverterLocation", v)} help="e.g. garage wall, utility room" />
              <Field label="Actual battery location"  value={ab.actualBatteryLocation || ""}  onChange={v => setAsBuilt("actualBatteryLocation", v)}  help="e.g. next to inverter" />
              <Field label="Installer name" value={ab.installerName || ""} onChange={v => setAsBuilt("installerName", v)} />
              <Field label="Commissioning date" type="date" value={ab.commissioningDate || ""} onChange={v => setAsBuilt("commissioningDate", v)} />
            </div>
          </Card>

          <Card title="Commissioning test results" subtitle="Record pass/fail for mandatory commissioning tests (IEC 62446).">
            <div className="form-grid">
              {[
                ["actualEarthingContinuityPass",  "Earthing continuity — PASS"],
                ["actualInsulationResistancePass", "Insulation resistance ≥1 MΩ — PASS"],
                ["monitoringConfigured",           "Remote monitoring configured"],
                ["clientHandoverCompleted",        "Client handover completed"],
              ].map(([key, lbl]) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", border: `1.5px solid ${ab[key] ? "#86efac" : "#e2e8f0"}`, borderRadius: "0.5rem", cursor: "pointer", background: ab[key] ? "#f0fdf4" : "#fff", fontSize: "0.85rem", fontWeight: ab[key] ? 700 : 400 }}>
                  <input type="checkbox" checked={!!ab[key]} onChange={e => setAsBuilt(key, e.target.checked)} style={{ accentColor: "#10b981" }} />
                  {lbl}
                </label>
              ))}
            </div>
          </Card>

          {/* String measurements */}
          <Card title="String commissioning measurements" subtitle="Record measured Voc and Isc per string before connecting to inverter.">
            <div className="table-container">
              <table className="table">
                <thead><tr><th>String</th><th>Expected Voc (V)</th><th>Measured Voc (V)</th><th>Expected Isc (A)</th><th>Measured Isc (A)</th></tr></thead>
                <tbody>
                  {(liveStringPlan.strings || []).map((s, i) => {
                    const measVoc = (ab.measuredVoc || [])[i] || 0;
                    const measIsc = (ab.measuredIsc || [])[i] || 0;
                    const vocOk   = measVoc === 0 || Math.abs(measVoc - s.stringVocCold) / s.stringVocCold < 0.10;
                    const iscOk   = measIsc === 0 || Math.abs(measIsc - s.stringIsc) / s.stringIsc < 0.15;
                    return (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 700 }}>{s.label}</td>
                        <td style={{ color: "#64748b" }}>{s.stringVocCold} V</td>
                        <td>
                          <input type="number" step="0.1" value={measVoc || ""}
                            onChange={e => {
                              const arr = [...(ab.measuredVoc || Array(liveStringPlan.totalStrings || 1).fill(0))];
                              arr[i] = Number(e.target.value);
                              setAsBuilt("measuredVoc", arr);
                            }}
                            style={{ width: "90px", padding: "0.25rem 0.5rem", border: `1.5px solid ${!vocOk ? "#fca5a5" : "#e2e8f0"}`, borderRadius: "0.35rem", fontSize: "0.82rem" }} />
                        </td>
                        <td style={{ color: "#64748b" }}>{s.stringIsc} A</td>
                        <td>
                          <input type="number" step="0.01" value={measIsc || ""}
                            onChange={e => {
                              const arr = [...(ab.measuredIsc || Array(liveStringPlan.totalStrings || 1).fill(0))];
                              arr[i] = Number(e.target.value);
                              setAsBuilt("measuredIsc", arr);
                            }}
                            style={{ width: "90px", padding: "0.25rem 0.5rem", border: `1.5px solid ${!iscOk ? "#fca5a5" : "#e2e8f0"}`, borderRadius: "0.35rem", fontSize: "0.82rem" }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Notes & comparison" subtitle="">
            <div className="field-group">
              <span className="field-label">As-built notes</span>
              <textarea className="field-input" style={{ minHeight: "80px", resize: "vertical" }}
                value={ab.asBuiltNotes || ""}
                onChange={e => setAsBuilt("asBuiltNotes", e.target.value)}
                placeholder="Record any deviations, issues, or client notes..." />
            </div>
            {asBuiltIssues.length > 0 && (
              <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.25rem" }}>As-built comparison issues:</div>
                {asBuiltIssues.map((iss, i) => <SimBadge key={i} level={iss.level}>{iss.msg}</SimBadge>)}
              </div>
            )}
            {asBuiltIssues.length === 0 && (
              <SimBadge level="success">No deviations detected between planned and measured values.</SimBadge>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

/* ─── TECHNICIAN VIEW ────────────────────────────────────────────────── */

function TechnicianView({ project, sizing, simulation, liveStringPlan, simWarnings, panelLayout, multiRoofDist, steps }) {
  const completedSteps = simulation.installationChecklist.filter(Boolean).length;
  const dangerWarnings = simWarnings.filter(w => w.level === "danger");
  const warnWarnings   = simWarnings.filter(w => w.level === "warning");

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#fff", zIndex: 9000, overflow: "auto", padding: "1.5rem" }}>
      {/* Close bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", padding: "0.75rem 1rem", background: "#0f172a", borderRadius: "0.5rem", color: "#fff" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: "1rem" }}>🔧 Technician View — {project.client || "—"}</div>
          <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "0.1rem" }}>{project.location} · {project.systemType} · {num(sizing.actualKwp, 1)} kWp</div>
        </div>
        <button onClick={() => {}} style={{ padding: "0.4rem 0.9rem", borderRadius: "0.4rem", background: "#ef4444", border: "none", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: "0.82rem" }}>
          ✕ Close (use header toggle)
        </button>
      </div>

      {/* Critical warnings first */}
      {dangerWarnings.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          {dangerWarnings.map((w, i) => <SimBadge key={i} level="danger">{w.msg}</SimBadge>)}
        </div>
      )}

      <div className="grid-cols-2" style={{ marginBottom: "1rem" }}>
        {/* System quick-ref */}
        <Card title="System reference" subtitle="">
          {[
            ["PV Array",     `${num(sizing.actualKwp, 1)} kWp (${sizing.panels} × ${project.panelW}W)`],
            ["Battery",      `${num(sizing.batteryKwh, 1)} kWh · ${project.batteryChemistry}`],
            ["Inverter",     `${num(sizing.inverterKw, 1)} kW`],
            ["Panels/string", `${project.panelsPerString || 12}`],
            ["Strings",       `${liveStringPlan.totalStrings || sizing.strings || "—"}`],
            ["MPPT count",    `${project.inverterMpptCount || 2}`],
            ["Panel size",    `${project.panelLengthM || 2.28} m × ${project.panelWidthM || 1.13} m`],
            ["Inverter max DC", `${project.inverterMaxDcV || 1000} V`],
            ["Cold Voc/str",  `${sizing.stringVocCold?.toFixed(0) || "—"} V`],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "0.3rem 0", borderBottom: "1px solid #f1f5f9", fontSize: "0.82rem" }}>
              <span style={{ color: "#64748b" }}>{k}</span><span style={{ fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </Card>

        {/* String plan quick-ref */}
        <Card title="String / MPPT plan" subtitle="">
          {(liveStringPlan.strings || []).map((s, i) => (
            <div key={s.id} style={{ display: "flex", gap: "0.75rem", alignItems: "center", padding: "0.4rem 0", borderBottom: "1px solid #f1f5f9", fontSize: "0.82rem" }}>
              <div style={{ width: "16px", height: "16px", borderRadius: "3px", background: getStringColour(i), flexShrink: 0 }} />
              <span style={{ fontWeight: 700 }}>{s.label}</span>
              <span style={{ color: "#64748b" }}>{s.panelCount} panels · MPPT {s.mpptNumber}</span>
              <span style={{ color: "#64748b", marginLeft: "auto" }}>Voc {s.stringVocCold} V</span>
              {s.status !== "ok" && <span style={{ color: "#f59e0b", fontWeight: 700 }}>⚠</span>}
            </div>
          ))}
          {liveStringPlan.needsCombiner && (
            <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "#78350f", background: "#fffbeb", padding: "0.4rem 0.6rem", borderRadius: "0.35rem" }}>
              ⚠ Combiner / DC junction box required for {liveStringPlan.totalStrings} strings.
            </div>
          )}
        </Card>
      </div>

      {/* Warnings summary */}
      {warnWarnings.length > 0 && (
        <Card title="Installation warnings" subtitle="" style={{ marginBottom: "1rem" }}>
          {warnWarnings.map((w, i) => <SimBadge key={i} level="warning">{w.msg}</SimBadge>)}
        </Card>
      )}

      {/* Installation sequence */}
      <Card title={`Installation sequence — ${completedSteps}/${steps.length} completed`} subtitle="Print this page and tick steps as you go.">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem" }}>
          {steps.map((step, i) => {
            const done = simulation.installationChecklist[i];
            return (
              <div key={step.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", padding: "0.4rem 0.65rem", background: done ? "#f0fdf4" : "#fff", border: `1px solid ${done ? "#86efac" : "#e2e8f0"}`, borderRadius: "0.4rem", fontSize: "0.79rem" }}>
                <input type="checkbox" checked={done} onChange={() => {}} readOnly style={{ marginTop: "2px", flexShrink: 0 }} />
                <span style={{ color: done ? "#166534" : "#0f172a" }}><strong>{step.id}.</strong> {step.label}</span>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: "0.75rem", fontSize: "0.72rem", color: "#94a3b8" }}>
          ⚠ This is a planning guide only. Follow manufacturer instructions, local regulations, and safe work practices throughout.
        </div>
      </Card>
    </div>
  );
}

/* ─── END INSTALLER SIMULATION STUDIO ─────────────────────────────────── */

/* ═══════════════════════════════════════════════════════════════════════
   VOLTFLOW DELIVERY — EPC project management layer (v11.5)
   Delivery coordination support. Sign-off gates RECORD that a person approved
   something; they are not themselves an engineering approval.
   ═══════════════════════════════════════════════════════════════════════ */

const SEVERITY_TONE = { critical: "danger", high: "danger", medium: "warning", low: "neutral" };
const TASK_STATUS_TONE = { todo: "neutral", in_progress: "info", blocked: "danger", done: "success" };
const PROC_STATUS_TONE = { needed: "neutral", quoted: "info", ordered: "warning", received: "success", installed: "success" };

function DeliveryStageBar({ delivery, onStageChange, readOnly }) {
  const progress = getStageProgress(delivery);
  const [pendingStage, setPendingStage] = useState(null);
  const warnings = pendingStage ? getStageGateWarnings(delivery, pendingStage) : [];

  const commit = (stageKey) => { onStageChange(stageKey); setPendingStage(null); };
  const request = (stageKey) => {
    if (stageKey === delivery.stage) return;
    const w = getStageGateWarnings(delivery, stageKey);
    if (w.length === 0) commit(stageKey);
    else setPendingStage(stageKey);
  };

  return (
    <Card title="Project stage" subtitle={progress.terminal ? "This project is closed." : `Stage ${progress.index + 1} of ${progress.total} · ${progress.group}`}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.85rem" }}>
        <StatusPill tone={progress.terminal ? "danger" : "success"}>{progress.label}</StatusPill>
        <div style={{ flex: 1, minWidth: "180px", height: "8px", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden" }}>
          <div style={{ width: `${progress.percent}%`, height: "100%", background: "var(--color-primary)", transition: "width .3s ease" }} />
        </div>
        <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "var(--text-main)" }}>{progress.percent}%</span>
      </div>

      {!readOnly && (
        <div className="field-group">
          <span className="field-label">Move to stage</span>
          <select className="field-input" value={delivery.stage} onChange={(e) => request(e.target.value)}>
            {PROJECT_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      )}

      {pendingStage && (
        <div style={{ marginTop: "0.85rem", padding: "0.85rem 1rem", background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: "var(--radius-md)" }}>
          <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "#78350f", marginBottom: "0.5rem" }}>
            Check before moving to “{getStage(pendingStage)?.label}”
          </div>
          {warnings.map((w, i) => <SimBadge key={i} level={w.level}>{w.msg}</SimBadge>)}
          <ActionBar>
            <button className="btn btn-primary" onClick={() => commit(pendingStage)}>Move anyway</button>
            <button className="btn btn-secondary" onClick={() => setPendingStage(null)}>Cancel</button>
          </ActionBar>
          <div style={{ fontSize: "0.75rem", color: "#92400e", marginTop: "0.4rem" }}>
            These are advisory checks for delivery coordination, not engineering approval.
          </div>
        </div>
      )}
    </Card>
  );
}

function DeliveryOverview({ delivery, project, sizing, summary, blockers, nextActions, onStageChange, readOnly }) {
  const readiness = getProjectReadinessForStage(project, sizing, delivery);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <DeliveryStageBar delivery={delivery} onStageChange={onStageChange} readOnly={readOnly} />

      <CardGrid min={210}>
        <Metric label="Tasks Complete" value={`${summary.tasks.done}/${summary.tasks.total}`} hint={`${summary.tasks.percentComplete}% · ${summary.tasks.blocked} blocked`} good={summary.tasks.percentComplete === 100} danger={summary.tasks.blocked > 0} />
        <Metric label="Procurement" value={`${summary.procurement.received}/${summary.procurement.total}`} hint={summary.procurement.shortages > 0 ? `${summary.procurement.shortages} short` : "All received"} danger={summary.procurement.shortages > 0} />
        <Metric label="Installation Checklist" value={`${summary.checklist.percent}%`} hint={`${summary.checklist.done} of ${summary.checklist.total} items`} good={summary.checklist.percent === 100} />
        <Metric label="Open Issues" value={`${summary.issues.open}`} hint={summary.issues.critical > 0 ? `${summary.issues.critical} critical` : "None critical"} danger={summary.issues.critical > 0} />
      </CardGrid>

      <div className="grid-cols-2">
        <Card title="Next actions" subtitle="What should happen now, based on the current stage and open items.">
          {nextActions.length === 0
            ? <EmptyState icon="✅" title="Nothing outstanding" description="No next actions for this stage." />
            : <ol style={{ margin: 0, paddingLeft: "1.15rem", fontSize: "0.86rem", color: "var(--text-medium)", lineHeight: 1.9 }}>
                {nextActions.map((a, i) => <li key={i}>{a}</li>)}
              </ol>}
        </Card>

        <Card title={`Blockers (${blockers.length})`} subtitle="Critical/high issues, blocked tasks, overdue work and procurement shortages.">
          {blockers.length === 0
            ? <EmptyState icon="🟢" title="No blockers" description="Nothing is currently holding this project up." />
            : <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {blockers.slice(0, 10).map((b, i) => (
                  <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", padding: "0.5rem 0.7rem", background: "var(--bg-main)", border: "1px solid var(--border-medium)", borderRadius: "var(--radius-sm)" }}>
                    <StatusPill tone={SEVERITY_TONE[b.severity] || "neutral"}>{b.severity}</StatusPill>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "0.83rem", fontWeight: 700, color: "var(--text-main)" }}>{b.label}</div>
                      <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>{b.detail}</div>
                    </div>
                  </div>
                ))}
              </div>}
        </Card>
      </div>

      <Card title="Data readiness for this stage" subtitle="Whether the underlying project data supports the stage you are in.">
        {readiness.checks.length === 0
          ? <EmptyState icon="📋" title="No stage requirements yet" description="Checks appear as the project advances." />
          : readiness.checks.map((c) => (
              <div key={c.label} style={{ display: "flex", gap: "0.5rem", alignItems: "center", padding: "0.35rem 0", fontSize: "0.84rem" }}>
                <span>{c.ok ? "✅" : "⚠️"}</span>
                <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{c.label}</span>
                {!c.ok && <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>— {c.hint}</span>}
              </div>
            ))}
      </Card>
    </div>
  );
}

function DeliveryBoard({ delivery, project, sizing, summary, blockers }) {
  const column = getBoardColumn(delivery);
  const stage = getStageProgress(delivery);
  return (
    <div>
      <SectionHeader title="Stage board" subtitle="One card per active project. Multi-project boards arrive with cloud storage — this alpha stores one project at a time in the browser." />
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${STAGE_BOARD_COLUMNS.length}, minmax(160px, 1fr))`, gap: "0.65rem", overflowX: "auto", paddingBottom: "0.5rem" }}>
        {STAGE_BOARD_COLUMNS.map((col) => (
          <div key={col} style={{ background: "var(--bg-main)", border: "1px solid var(--border-medium)", borderRadius: "var(--radius-md)", padding: "0.6rem", minHeight: "180px" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "0.5rem", textTransform: "uppercase" }}>
              {col}
            </div>
            {column === col && (
              <div className="vf-card-enter" style={{ background: "var(--bg-card)", border: `1.5px solid var(--color-primary)`, borderRadius: "var(--radius-sm)", padding: "0.6rem", boxShadow: "var(--shadow-sm)" }}>
                <div style={{ fontWeight: 800, fontSize: "0.83rem", color: "var(--text-main)", wordBreak: "break-word" }}>{project.client || "Untitled project"}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>{project.location || "No location"}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{project.systemType || "System type not set"}</div>
                <div style={{ margin: "0.4rem 0" }}><StatusPill tone="info">{stage.label}</StatusPill></div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-medium)" }}>Owner: {delivery.owner || "—"}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-medium)" }}>Value: {money(sizing.totalCost || delivery.projectValue)}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-medium)" }}>Due: {delivery.expectedCompletionDate || "—"}</div>
                <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
                  {blockers.length > 0 && <StatusPill tone="danger">{blockers.length} blocker{blockers.length === 1 ? "" : "s"}</StatusPill>}
                  {summary.issues.open > 0 && <StatusPill tone="warning">{summary.issues.open} open</StatusPill>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {getStage(delivery.stage)?.terminal && (
        <WarningPanel tone="danger" title="Project closed">
          This project is marked “{getStage(delivery.stage).label}” and is not shown on the active board columns.
        </WarningPanel>
      )}
    </div>
  );
}

function DeliveryTasks({ delivery, onChange, showToast }) {
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const tasks = delivery.tasks || [];

  const update = (id, patch) => onChange({ ...delivery, tasks: tasks.map((t) => t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t) });
  const addTask = () => { onChange({ ...delivery, tasks: [createTask({ title: "New task" }), ...tasks] }); showToast("Task added — set the title, owner and due date."); };
  const removeTask = (id) => onChange({ ...delivery, tasks: tasks.filter((t) => t.id !== id) });

  const visible = tasks.filter((t) =>
    (filterStatus === "all" || t.status === filterStatus) &&
    (filterCategory === "all" || t.category === filterCategory));

  return (
    <div>
      <SectionHeader title={`Tasks (${tasks.length})`} subtitle="Delivery task list for this project. Categories follow the EPC workflow."
        actions={<button onClick={addTask} className="btn btn-primary" style={{ fontSize: "0.8rem" }}>+ Add task</button>} />
      <FormGrid min={180} style={{ marginBottom: "0.85rem" }}>
        <div className="field-group">
          <span className="field-label">Filter by status</span>
          <select className="field-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {TASK_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </div>
        <div className="field-group">
          <span className="field-label">Filter by category</span>
          <select className="field-input" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="all">All categories</option>
            {TASK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </FormGrid>

      {visible.length === 0 ? (
        <EmptyState icon="🗒" title="No tasks match" description="Change the filters, or add a task for this project." />
      ) : (
        <ResponsiveTable compact>
          <table className="table vf-table">
            <thead>
              <tr><th>Task</th><th>Category</th><th>Owner</th><th>Due</th><th>Priority</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t.id} style={t.status === "blocked" ? { background: "#fef2f2" } : undefined}>
                  <td style={{ minWidth: "200px" }}>
                    <input className="table-input" value={t.title} onChange={(e) => update(t.id, { title: e.target.value })} />
                    <input className="table-input" style={{ marginTop: "0.25rem", fontSize: "0.75rem" }} placeholder="Notes…" value={t.notes} onChange={(e) => update(t.id, { notes: e.target.value })} />
                  </td>
                  <td>
                    <select className="select-input" value={t.category} onChange={(e) => update(t.id, { category: e.target.value })}>
                      {TASK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td><input className="table-input" style={{ width: "110px" }} placeholder="Owner" value={t.owner} onChange={(e) => update(t.id, { owner: e.target.value })} /></td>
                  <td><input type="date" className="table-input" style={{ width: "135px" }} value={t.dueDate} onChange={(e) => update(t.id, { dueDate: e.target.value })} /></td>
                  <td>
                    <select className="select-input" value={t.priority} onChange={(e) => update(t.id, { priority: e.target.value })}>
                      {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="select-input" value={t.status} onChange={(e) => update(t.id, { status: e.target.value })}>
                      {TASK_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                    </select>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.3rem" }}>
                      {t.status !== "done" && <button onClick={() => update(t.id, { status: "done" })} className="btn btn-accent" style={{ padding: "0.25rem 0.5rem", fontSize: "0.72rem" }}>✓</button>}
                      <button onClick={() => removeTask(t.id)} className="btn btn-danger" style={{ padding: "0.25rem 0.5rem", fontSize: "0.72rem" }}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
      )}
    </div>
  );
}

function DeliveryProcurement({ delivery, onChange, boqRows, showToast, hideCosts }) {
  const [pendingMerge, setPendingMerge] = useState(null);
  const items = delivery.procurementItems || [];

  const update = (id, patch) => onChange({ ...delivery, procurementItems: items.map((p) => p.id === id ? { ...p, ...patch, manuallyEdited: true } : p) });
  const remove = (id) => onChange({ ...delivery, procurementItems: items.filter((p) => p.id !== id) });

  const generate = () => {
    const generated = generateProcurementFromBoq(boqRows);
    if (items.length === 0) {
      onChange({ ...delivery, procurementItems: generated });
      showToast(`Generated ${generated.length} procurement line(s) from the current BoQ.`);
      return;
    }
    // Never silently overwrite manual edits — show what would happen first.
    setPendingMerge(mergeProcurement(items, generated));
  };

  const applyMerge = () => {
    onChange({ ...delivery, procurementItems: pendingMerge.items });
    showToast(`Procurement updated — ${pendingMerge.added} added, ${pendingMerge.refreshed} refreshed, ${pendingMerge.kept} manual line(s) kept.`);
    setPendingMerge(null);
  };

  const exportCsv = () => {
    const csv = procurementRowsToCsv(buildProcurementExportRows(delivery));
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "voltflow_procurement.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const totalValue = items.reduce((s, p) => s + (Number(p.requiredQty) || 0) * (Number(p.unitCost) || 0), 0);

  return (
    <div>
      <SectionHeader title={`Procurement (${items.length})`} subtitle="Linked to the current BoQ. Manually edited lines are never overwritten without confirmation."
        actions={<>
          <button onClick={generate} className="btn btn-primary" style={{ fontSize: "0.8rem" }}>⟳ Generate from BoQ</button>
          {items.length > 0 && <button onClick={exportCsv} className="btn btn-secondary" style={{ fontSize: "0.8rem" }}>📥 Export CSV</button>}
        </>} />

      {pendingMerge && (
        <Card title="Confirm procurement update" subtitle="Regenerating from the BoQ would change this list.">
          <ul style={{ margin: 0, paddingLeft: "1.15rem", fontSize: "0.86rem", lineHeight: 1.8, color: "var(--text-medium)" }}>
            <li><strong>{pendingMerge.added}</strong> new line(s) added from the BoQ</li>
            <li><strong>{pendingMerge.refreshed}</strong> untouched line(s) refreshed with current BoQ quantities/costs</li>
            <li><strong>{pendingMerge.kept}</strong> manually edited or manually added line(s) kept exactly as they are</li>
          </ul>
          <ActionBar>
            <button onClick={applyMerge} className="btn btn-primary">✓ Apply update</button>
            <button onClick={() => setPendingMerge(null)} className="btn btn-secondary">Cancel</button>
          </ActionBar>
        </Card>
      )}

      {items.length === 0 ? (
        <EmptyState icon="📦" title="No procurement list yet"
          description="Generate it from the current BoQ once sizing is settled, then track quotes, orders and deliveries here."
          action={<button onClick={generate} className="btn btn-primary">Generate from BoQ</button>} />
      ) : (
        <>
          {!hideCosts && (
            <CardGrid min={200} style={{ marginBottom: "0.85rem" }}>
              <Metric label="Procurement Value" value={money(totalValue)} hint="Required qty × unit cost" />
              <Metric label="Lines Received" value={`${items.filter((p) => p.status === "received" || p.status === "installed").length}/${items.length}`} />
              <Metric label="Shortages" value={`${items.filter((p) => (Number(p.receivedQty) || 0) < (Number(p.requiredQty) || 0) && p.status !== "installed").length}`} danger={items.some((p) => (Number(p.receivedQty) || 0) < (Number(p.requiredQty) || 0) && p.status !== "installed")} />
            </CardGrid>
          )}
          <ResponsiveTable compact>
            <table className="table vf-table">
              <thead>
                <tr>
                  <th>Item</th><th>Req</th><th>Ordered</th><th>Received</th><th>Unit</th>
                  <th>Supplier</th>{!hideCosts && <th>Unit cost</th>}{!hideCosts && <th>Line value</th>}<th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const short = (Number(p.receivedQty) || 0) < (Number(p.requiredQty) || 0) && p.status !== "installed";
                  return (
                    <tr key={p.id} style={short ? { background: "#fffbeb" } : undefined}>
                      <td style={{ minWidth: "180px" }}>
                        <input className="table-input" value={p.item} onChange={(e) => update(p.id, { item: e.target.value })} />
                        {p.linkedBoqItem && <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>BoQ {p.linkedBoqItem}{p.manuallyEdited ? " · edited" : ""}</div>}
                      </td>
                      <td><input type="number" className="table-input" style={{ width: "70px" }} value={p.requiredQty} onChange={(e) => update(p.id, { requiredQty: Math.max(0, Number(e.target.value) || 0) })} /></td>
                      <td><input type="number" className="table-input" style={{ width: "70px" }} value={p.orderedQty} onChange={(e) => update(p.id, { orderedQty: Math.max(0, Number(e.target.value) || 0) })} /></td>
                      <td><input type="number" className="table-input" style={{ width: "70px" }} value={p.receivedQty} onChange={(e) => update(p.id, { receivedQty: Math.max(0, Number(e.target.value) || 0) })} /></td>
                      <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{p.unit}</td>
                      <td><input className="table-input" style={{ width: "120px" }} placeholder="Supplier" value={p.supplier} onChange={(e) => update(p.id, { supplier: e.target.value })} /></td>
                      {!hideCosts && <td><input type="number" className="table-input" style={{ width: "95px" }} value={p.unitCost} onChange={(e) => update(p.id, { unitCost: Math.max(0, Number(e.target.value) || 0) })} /></td>}
                      {!hideCosts && <td className="vf-num-strong">{money((Number(p.requiredQty) || 0) * (Number(p.unitCost) || 0))}</td>}
                      <td>
                        <select className="select-input" value={p.status} onChange={(e) => update(p.id, { status: e.target.value })}>
                          {PROCUREMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td><button onClick={() => remove(p.id)} className="btn btn-danger" style={{ padding: "0.25rem 0.5rem", fontSize: "0.72rem" }}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
              {!hideCosts && (
                <tfoot>
                  <tr className="vf-table-totals">
                    <td colSpan={7}>Total procurement value</td>
                    <td className="vf-num-strong">{money(totalValue)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </ResponsiveTable>
        </>
      )}
    </div>
  );
}

function DeliveryChecklist({ delivery, onChange }) {
  const list = delivery.installationChecklist || [];
  const progress = getChecklistProgress(delivery);
  const update = (key, patch) => onChange({ ...delivery, installationChecklist: list.map((c) => c.key === key ? { ...c, ...patch } : c) });
  const phases = [...new Set(list.map((c) => c.phase))];

  return (
    <div>
      <SectionHeader title="Installation & commissioning checklist"
        subtitle={`${progress.done} of ${progress.total} complete (${progress.percent}%). Complements the step-by-step sequence in Installer Simulation — this one is the sign-off record.`} />
      <div style={{ height: "8px", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden", marginBottom: "1rem" }}>
        <div style={{ width: `${progress.percent}%`, height: "100%", background: progress.percent === 100 ? "var(--color-primary)" : "#f59e0b", transition: "width .3s ease" }} />
      </div>

      {phases.map((phase) => (
        <Card key={phase} title={phase} subtitle="">
          {list.filter((c) => c.phase === phase).map((c) => (
            <div key={c.key} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.6rem", alignItems: "start", padding: "0.5rem 0", borderBottom: "1px solid var(--border-light)" }}>
              <input type="checkbox" checked={c.complete} style={{ width: "18px", height: "18px", accentColor: "var(--color-primary)", marginTop: "2px" }}
                onChange={(e) => update(c.key, { complete: e.target.checked, dateCompleted: e.target.checked ? (c.dateCompleted || new Date().toISOString().slice(0, 10)) : "" })} />
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.86rem", color: c.complete ? "var(--text-muted)" : "var(--text-main)", textDecoration: c.complete ? "line-through" : "none" }}>{c.label}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.4rem", marginTop: "0.35rem" }}>
                  <input className="table-input" placeholder="Signed off by" value={c.owner} onChange={(e) => update(c.key, { owner: e.target.value })} />
                  <input type="date" className="table-input" value={c.dateCompleted} onChange={(e) => update(c.key, { dateCompleted: e.target.value })} />
                  <input className="table-input" placeholder="Notes" value={c.notes} onChange={(e) => update(c.key, { notes: e.target.value })} />
                </div>
              </div>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}

function DeliveryIssues({ delivery, onChange, showToast }) {
  const issues = delivery.issues || [];
  const update = (id, patch) => onChange({ ...delivery, issues: issues.map((i) => i.id === id ? { ...i, ...patch } : i) });
  const add = () => { onChange({ ...delivery, issues: [createIssue({ title: "New issue" }), ...issues] }); showToast("Issue logged — set the severity and owner."); };
  const remove = (id) => onChange({ ...delivery, issues: issues.filter((i) => i.id !== id) });
  const resolve = (id) => update(id, { status: "resolved", resolvedAt: new Date().toISOString() });

  return (
    <div>
      <SectionHeader title={`Issues & snags (${issues.filter((i) => i.status !== "resolved").length} open)`}
        subtitle="Site problems, defects and snags. Critical/high open issues appear as blockers on the delivery dashboard."
        actions={<button onClick={add} className="btn btn-primary" style={{ fontSize: "0.8rem" }}>+ Log issue</button>} />
      {issues.length === 0 ? (
        <EmptyState icon="🔧" title="No issues logged" description="Log site problems, defects and snags here so they show up as delivery blockers." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {issues.map((i) => (
            <Card key={i.id} title="" subtitle="" style={{ marginBottom: 0, borderLeft: `4px solid ${i.status === "resolved" ? "#10b981" : i.severity === "critical" ? "#ef4444" : i.severity === "high" ? "#f59e0b" : "#cbd5e1"}` }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                <StatusPill tone={i.status === "resolved" ? "success" : SEVERITY_TONE[i.severity] || "neutral"}>{i.status === "resolved" ? "resolved" : i.severity}</StatusPill>
                <input className="table-input" style={{ flex: 1, minWidth: "180px", fontWeight: 700 }} value={i.title} onChange={(e) => update(i.id, { title: e.target.value })} />
              </div>
              <FormGrid min={140}>
                <div className="field-group">
                  <span className="field-label">Severity</span>
                  <select className="field-input" value={i.severity} onChange={(e) => update(i.id, { severity: e.target.value })}>
                    {ISSUE_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field-group">
                  <span className="field-label">Status</span>
                  <select className="field-input" value={i.status} onChange={(e) => update(i.id, { status: e.target.value })}>
                    {ISSUE_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  </select>
                </div>
                <div className="field-group">
                  <span className="field-label">Owner</span>
                  <input className="field-input" value={i.owner} onChange={(e) => update(i.id, { owner: e.target.value })} />
                </div>
              </FormGrid>
              <div className="field-group" style={{ marginTop: "0.5rem" }}>
                <span className="field-label">Notes</span>
                <input className="field-input" value={i.notes} onChange={(e) => update(i.id, { notes: e.target.value })} />
              </div>
              {i.status === "resolved" && (
                <div className="field-group" style={{ marginTop: "0.5rem" }}>
                  <span className="field-label">Resolution notes</span>
                  <input className="field-input" value={i.resolutionNotes} onChange={(e) => update(i.id, { resolutionNotes: e.target.value })} />
                </div>
              )}
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.5rem", cursor: "pointer" }}>
                <input type="checkbox" checked={!!i.clientVisible} onChange={(e) => update(i.id, { clientVisible: e.target.checked })} style={{ accentColor: "var(--color-primary)" }} />
                Share this issue with the client (visible in Client View)
              </label>
              <ActionBar>
                {i.status !== "resolved" && <button onClick={() => resolve(i.id)} className="btn btn-accent" style={{ fontSize: "0.78rem" }}>✓ Mark resolved</button>}
                <button onClick={() => remove(i.id)} className="btn btn-secondary" style={{ fontSize: "0.78rem", color: "var(--color-red)" }}>Delete</button>
                {i.resolvedAt && <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Resolved {new Date(i.resolvedAt).toLocaleDateString()}</span>}
              </ActionBar>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function DeliveryApprovals({ delivery, onChange, showToast }) {
  const approvals = delivery.approvals || {};
  const set = (key, patch) => onChange({ ...delivery, approvals: { ...approvals, [key]: { ...approvals[key], ...patch } } });
  const toggle = (key, on) => {
    set(key, { approved: on, approvedAt: on ? new Date().toISOString() : null });
    if (on) showToast(`${APPROVAL_GATES.find((g) => g.key === key)?.label} recorded.`);
  };

  return (
    <div>
      <SectionHeader title="Approval gates"
        subtitle="Records that a named person approved a step, with a date. This is a delivery audit trail — it does not constitute engineering or regulatory approval." />
      {APPROVAL_GATES.map((g) => {
        const a = approvals[g.key] || {};
        return (
          <Card key={g.key} title={g.label} subtitle={`Required before: ${getStage(g.requiredForStage)?.label || "—"}`}>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.6rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem" }}>
                <input type="checkbox" checked={!!a.approved} onChange={(e) => toggle(g.key, e.target.checked)} style={{ width: "18px", height: "18px", accentColor: "var(--color-primary)" }} />
                {a.approved ? "Approved" : "Not approved"}
              </label>
              {a.approved && a.approvedAt && <StatusPill tone="success">{new Date(a.approvedAt).toLocaleDateString()}</StatusPill>}
            </div>
            <FormGrid min={180}>
              <div className="field-group">
                <span className="field-label">Approved by</span>
                <input className="field-input" value={a.approvedBy || ""} onChange={(e) => set(g.key, { approvedBy: e.target.value })} placeholder="Name / role" />
              </div>
              <div className="field-group">
                <span className="field-label">Notes</span>
                <input className="field-input" value={a.notes || ""} onChange={(e) => set(g.key, { notes: e.target.value })} />
              </div>
            </FormGrid>
          </Card>
        );
      })}
      <WarningPanel tone="info" title="Delivery audit trail only">
        Recording an approval here does not replace licensed engineering sign-off, protection coordination,
        structural checks, KPLC/EPRA approval or commissioning certification.
      </WarningPanel>
    </div>
  );
}

/** Client-safe delivery view: timeline only, no costs, no internal issues. */
function DeliveryClientTimeline({ delivery, project }) {
  const timeline = getClientTimeline(delivery);
  const shared = getClientVisibleIssues(delivery);
  return (
    <div className="vf-page-enter">
      <PageHeader eyebrow="Project progress" title="Where your project is"
        description={`${project.client || "Your project"}${project.location ? ` · ${project.location}` : ""}`} />
      <Card title="Project timeline" subtitle="A simple view of the stages your installation moves through.">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
          {timeline.map((m) => (
            <div key={m.key} style={{ display: "flex", gap: "0.75rem", alignItems: "center", padding: "0.65rem 0.5rem",
              background: m.state === "current" ? "#ecfdf5" : "transparent", borderRadius: "var(--radius-sm)" }}>
              <span style={{ fontSize: "1.05rem" }}>{m.state === "done" ? "✅" : m.state === "current" ? "🔵" : "⚪"}</span>
              <span style={{ fontWeight: m.state === "current" ? 800 : 600, fontSize: "0.9rem",
                color: m.state === "upcoming" ? "var(--text-muted)" : "var(--text-main)" }}>{m.label}</span>
              {m.state === "current" && <StatusPill tone="success">In progress</StatusPill>}
            </div>
          ))}
        </div>
      </Card>
      {shared.length > 0 && (
        <Card title="Items we are following up" subtitle="Points your team has chosen to share with you.">
          {shared.map((i) => (
            <div key={i.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--border-light)" }}>
              <div style={{ fontWeight: 700, fontSize: "0.86rem" }}>{i.title}</div>
              {i.notes && <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>{i.notes}</div>}
              <StatusPill tone={i.status === "resolved" ? "success" : "warning"}>{i.status === "resolved" ? "Resolved" : "In progress"}</StatusPill>
            </div>
          ))}
        </Card>
      )}
      <WarningPanel tone="info" title="Please note">
        Dates and stages are indicative and may change with site conditions, equipment availability and weather.
        Final engineering design and installation approval require qualified review.
      </WarningPanel>
    </div>
  );
}

function ProjectDelivery({ project, setProject, sizing, accessoriesBoQ, viewMode, showToast }) {
  const [tab, setTab] = useState("overview");
  const delivery = project.delivery || createDefaultDelivery(project, sizing, []);
  const onChange = (next) => setProject((p) => ({ ...p, delivery: { ...next, updatedAt: new Date().toISOString() } }));

  const summary = useMemo(() => summarizeDelivery(delivery), [delivery]);
  const blockers = useMemo(() => getBlockedItems(delivery), [delivery]);
  const nextActions = useMemo(() => getNextActions(delivery, project, sizing), [delivery, project, sizing]);

  // Normalised BoQ rows for procurement generation: engineering BoQ major
  // equipment + the accessories/BOS lines already computed elsewhere.
  const boqRows = useMemo(() => {
    const rows = [
      { code: "1.1", item: "PV panels", qty: sizing.panels, unit: "panels", unitCost: project.panelCost, category: "PV" },
      { code: "1.2", item: "Mounting rails, clamps & hardware", qty: sizing.panels, unit: "sets", unitCost: project.mountingPerPanel, category: "Mounting" },
      { code: "2.1", item: "Hybrid/grid-tied inverter", qty: 1, unit: "unit", unitCost: sizing.inverterCost, category: "Inverter" },
      { code: "3.1", item: "Battery modules", qty: sizing.batteryModules, unit: "units", unitCost: project.batteryModuleCost, category: "Battery" },
      { code: "4.1", item: "DC/AC cabling, breakers, SPDs, earthing", qty: 1, unit: "lot", unitCost: project.cablingProtectionCost, category: "Electrical" },
      { code: "5.1", item: "Monitoring system", qty: 1, unit: "lot", unitCost: project.monitoringCost, category: "Monitoring" },
    ].filter((r) => (Number(r.qty) || 0) > 0);
    if (accessoriesBoQ?.categories) {
      Object.values(accessoriesBoQ.categories).flat().forEach((a) => {
        rows.push({ code: a.itemCode, item: a.name, qty: a.qty, unit: a.unit, unitCost: a.unitCost, category: a.category || "BOS" });
      });
    }
    return rows;
  }, [sizing, project, accessoriesBoQ]);

  if (viewMode === "client") return <DeliveryClientTimeline delivery={delivery} project={project} />;

  const isTechnician = viewMode === "technician";
  const tabs = isTechnician
    ? [["overview", "📋 Overview"], ["checklist", "🔧 Installation"], ["tasks", "🗒 My tasks"], ["issues", "⚠ Issues"]]
    : [["overview", "📋 Overview"], ["board", "🗂 Stage board"], ["tasks", "🗒 Tasks"], ["procurement", "📦 Procurement"],
       ["checklist", "🔧 Installation"], ["issues", "⚠ Issues"], ["approvals", "✅ Approvals"]];

  return (
    <div className="vf-page-enter">
      <PageHeader eyebrow="Voltflow Delivery" title="Project Delivery"
        description="Solar EPC delivery coordination: stages, tasks, procurement, installation, issues and approvals for this project."
        actions={<StatusPill tone={summary.issues.critical > 0 ? "danger" : "info"}>{getStage(delivery.stage)?.label}</StatusPill>} />

      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1.15rem" }}>
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ padding: "0.4rem 0.85rem", borderRadius: "1rem", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer",
              border: "1.5px solid", borderColor: tab === key ? "var(--color-primary)" : "#e2e8f0",
              background: tab === key ? "var(--color-primary)" : "#fff", color: tab === key ? "#fff" : "#475569" }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <DeliveryOverview delivery={delivery} project={project} sizing={sizing} summary={summary}
        blockers={blockers} nextActions={nextActions} readOnly={isTechnician}
        onStageChange={(stage) => onChange({ ...delivery, stage })} />}
      {tab === "board" && !isTechnician && <DeliveryBoard delivery={delivery} project={project} sizing={sizing} summary={summary} blockers={blockers} />}
      {tab === "tasks" && <DeliveryTasks delivery={delivery} onChange={onChange} showToast={showToast} />}
      {tab === "procurement" && !isTechnician && <DeliveryProcurement delivery={delivery} onChange={onChange} boqRows={boqRows} showToast={showToast} />}
      {tab === "checklist" && <DeliveryChecklist delivery={delivery} onChange={onChange} />}
      {tab === "issues" && <DeliveryIssues delivery={delivery} onChange={onChange} showToast={showToast} />}
      {tab === "approvals" && !isTechnician && <DeliveryApprovals delivery={delivery} onChange={onChange} showToast={showToast} />}

      {!isTechnician && tab === "overview" && (
        <Card title="Delivery details" subtitle="Ownership and expected dates for this project.">
          <FormGrid min={190}>
            <div className="field-group">
              <span className="field-label">Delivery owner</span>
              <input className="field-input" value={delivery.owner} onChange={(e) => onChange({ ...delivery, owner: e.target.value })} placeholder="Project manager" />
            </div>
            <div className="field-group">
              <span className="field-label">Priority</span>
              <select className="field-input" value={delivery.priority} onChange={(e) => onChange({ ...delivery, priority: e.target.value })}>
                {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="field-group">
              <span className="field-label">Expected start</span>
              <input type="date" className="field-input" value={delivery.expectedStartDate} onChange={(e) => onChange({ ...delivery, expectedStartDate: e.target.value })} />
            </div>
            <div className="field-group">
              <span className="field-label">Expected completion</span>
              <input type="date" className="field-input" value={delivery.expectedCompletionDate} onChange={(e) => onChange({ ...delivery, expectedCompletionDate: e.target.value })} />
            </div>
          </FormGrid>
        </Card>
      )}

      <WarningPanel tone="info" title="Voltflow Internal Alpha">
        Voltflow Delivery supports solar EPC project coordination. It is not a certified engineering approval system —
        final engineering design, protection coordination, commissioning certification and regulatory approval all
        require qualified review.
      </WarningPanel>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   CLEAN STARTUP — v11.4.1
   The app opens with no client project loaded. The start screen is the only
   way in: new project, saved project, import, demo, or energy-data upload.
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * ResetLocalDataPanel — v11.4.1
 * Testers upgrading from older builds may still hold demo/Karen projects in
 * this browser. Nothing auto-loads, but this gives them a deliberate way to
 * clear it. Destructive → always confirm, always offer a backup first, and
 * never delete tester feedback unless they explicitly tick that box.
 */
function ResetLocalDataPanel({ showToast, onCleared, compact }) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [alsoFeedback, setAlsoFeedback] = useState(false);

  const openPanel = () => { setSummary(summarizeLocalData()); setAlsoFeedback(false); setOpen(true); };

  const backupFirst = () => {
    const { filename, jsonString } = exportAllLocalData(APP_VERSION);
    const blob = new Blob([jsonString], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("Backup downloaded — keep this file safe before resetting.");
  };

  const doReset = () => {
    const res = clearLocalProjectData({ includeFeedback: alsoFeedback });
    setOpen(false);
    setSummary(null);
    if (onCleared) onCleared();
    showToast(
      `Local data reset — ${res.clearedProjects} project(s) and ${res.clearedAssistantMessages} chat message(s) removed` +
      (res.keptFeedback > 0 ? `; ${res.keptFeedback} feedback entr${res.keptFeedback === 1 ? "y" : "ies"} kept.` : ".")
    );
  };

  if (!open) {
    return (
      <button onClick={openPanel}
        style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: compact ? "0.78rem" : "0.8rem",
          fontWeight: 700, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
        {compact ? "Clear local demo data" : "Reset local demo/startup data"}
      </button>
    );
  }

  const nothingToClear = summary && summary.savedProjects === 0 && summary.assistantMessages === 0 && !summary.hasLastSession;

  return (
    <Card title="Reset local demo/startup data"
      subtitle="Clears data stored in THIS browser only. Nothing is sent anywhere, and nothing on other devices is affected.">
      {nothingToClear ? (
        <EmptyState icon="✨" title="This browser is already clean"
          description="No saved projects, no resumable session and no assistant history are stored here." />
      ) : (
        <>
          <ResponsiveDataTable
            stickyHeader={false}
            compact
            columns={[
              { key: "item", label: "Stored in this browser" },
              { key: "count", label: "Count", align: "right", bold: true },
              { key: "effect", label: "On reset" },
            ]}
            rows={[
              { item: "Saved projects", count: summary.savedProjects, effect: "Deleted permanently" },
              { item: "Resume pointer (last opened project)", count: summary.hasLastSession ? 1 : 0, effect: "Deleted" },
              { item: "AI assistant chat history", count: summary.assistantMessages, effect: "Deleted" },
              { item: "Tester feedback entries", count: summary.feedbackEntries, effect: alsoFeedback ? "Deleted permanently" : "KEPT" },
            ]}
            getRowKey={(r) => r.item}
          />
          {summary.savedProjects > 0 && (
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.6rem" }}>
              Includes: {summary.savedProjectNames.join(", ")}{summary.savedProjects > summary.savedProjectNames.length ? "…" : ""}
            </div>
          )}
          <WarningPanel tone="danger" title="This cannot be undone">
            Saved projects live only in this browser. Download a backup first if there is anything you might need —
            including any older demo projects you want to keep for reference.
          </WarningPanel>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", color: "#7f1d1d", margin: "0.5rem 0 0.75rem", cursor: "pointer" }}>
            <input type="checkbox" checked={alsoFeedback} onChange={(e) => setAlsoFeedback(e.target.checked)} style={{ accentColor: "#ef4444" }} />
            Also delete my {summary.feedbackEntries} tester feedback entr{summary.feedbackEntries === 1 ? "y" : "ies"} (not recommended — export them to the Voltflow team first)
          </label>
        </>
      )}
      <ActionBar>
        {!nothingToClear && <button onClick={backupFirst} className="btn btn-primary">📥 Download backup first</button>}
        {!nothingToClear && <button onClick={doReset} className="btn btn-danger">🗑 Delete permanently</button>}
        <button onClick={() => setOpen(false)} className="btn btn-secondary">Cancel</button>
      </ActionBar>
    </Card>
  );
}

function StartScreen({ showToast, onLocalDataCleared, ...workspaceProps }) {
  return (
    <WorkspaceHome {...workspaceProps}>
      <details className="vfw-data-tools">
        <summary>Browser data tools</summary>
        <ResetLocalDataPanel showToast={showToast} onCleared={onLocalDataCleared} />
      </details>
    </WorkspaceHome>
  );
}

/* ─── DEMO PICKER ───────────────────────────────────────────────────────── */

function DemoPicker({ onLoadDemo, onBack }) {
  return (
    <div className="vf-page-enter">
      <PageHeader eyebrow="Sample data" title="Try a demo project"
        description="Demo projects are clearly badged and never overwrite a real project. Use one to explore the workflow, then convert it into a real project if you want to keep going."
        actions={<button onClick={onBack} className="btn btn-secondary">← Back</button>} />
      <WarningPanel tone="info" title="Demo data only">{DEMO_DISCLAIMER}</WarningPanel>
      <CardGrid min={280} gap="1rem">
        {DEMO_PROJECTS.map((d) => (
          <div key={d.id} className="vf-card-enter" style={{ background: "var(--bg-card)", border: "1.5px solid #e2e8f0", borderRadius: "var(--radius-lg)", padding: "1.1rem", display: "flex", flexDirection: "column", gap: "0.5rem", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              <StatusPill tone="premium">DEMO</StatusPill>
              {d.tags.map((t) => <StatusPill key={t} tone="neutral">{t}</StatusPill>)}
            </div>
            <div style={{ fontWeight: 800, fontSize: "0.92rem", color: "var(--text-main)" }}>{d.label}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.55, flex: 1 }}>{d.description}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{d.loads.length} sample loads</div>
            <button onClick={() => onLoadDemo(d.id)} className="btn btn-primary" style={{ marginTop: "0.3rem" }}>Load this demo</button>
          </div>
        ))}
      </CardGrid>
    </div>
  );
}

/* ─── ONBOARDING WIZARD ─────────────────────────────────────────────────── */

const WIZARD_STEPS = ["Client", "Site", "Objective", "Load source", "Create"];

function OnboardingWizard({ siteProfileNames, onCreate, onCancel }) {
  const [step, setStep] = useState(0);
  const [a, setA] = useState({
    client: "", contact: "", preparedBy: "Solarise Engineer",
    location: "", siteProfile: "", siteType: "Residential", phase: "", monthlyBill: 0,
    objectiveKey: "", loadSourceKey: "",
  });
  const set = (k, v) => setA((prev) => ({ ...prev, [k]: v }));

  const canAdvance =
    step === 0 ? !!a.client.trim() :
    step === 1 ? !!a.location.trim() :
    step === 2 ? !!a.objectiveKey :
    step === 3 ? !!a.loadSourceKey : true;

  const objective = getObjective(a.objectiveKey);
  const source = getLoadSource(a.loadSourceKey);

  return (
    <div className="vf-page-enter" style={{ maxWidth: "820px", margin: "0 auto" }}>
      <PageHeader eyebrow={`Step ${step + 1} of ${WIZARD_STEPS.length}`} title="Start a new project"
        description="Only the basics — everything else can be refined later in the engineering tabs."
        actions={<button onClick={onCancel} className="btn btn-secondary">Cancel</button>} />

      {/* progress */}
      <div style={{ display: "flex", gap: "0.35rem", marginBottom: "1.35rem" }}>
        {WIZARD_STEPS.map((label, i) => (
          <div key={label} style={{ flex: 1 }}>
            <div style={{ height: "4px", borderRadius: "2px", background: i <= step ? "var(--color-primary)" : "#e2e8f0", transition: "background-color .25s ease" }} />
            <div style={{ fontSize: "0.68rem", marginTop: "0.3rem", fontWeight: i === step ? 800 : 600, color: i <= step ? "var(--text-main)" : "var(--text-muted)" }}>{label}</div>
          </div>
        ))}
      </div>

      <Card title={WIZARD_STEPS[step]} subtitle={
        step === 0 ? "Who is this project for?" :
        step === 1 ? "Where is the site?" :
        step === 2 ? "What is the client trying to achieve?" :
        step === 3 ? "Where will the load data come from?" :
        "Review and create the project."}>

        {step === 0 && (
          <FormGrid min={220}>
            <div className="field-group">
              <span className="field-label">Client / company name *</span>
              <input className="field-input" autoFocus value={a.client} onChange={(e) => set("client", e.target.value)} placeholder="e.g. Acme Ltd or J. Mwangi" />
            </div>
            <div className="field-group">
              <span className="field-label">Contact (optional)</span>
              <input className="field-input" value={a.contact} onChange={(e) => set("contact", e.target.value)} placeholder="Phone or email" />
            </div>
            <div className="field-group">
              <span className="field-label">Prepared by</span>
              <input className="field-input" value={a.preparedBy} onChange={(e) => set("preparedBy", e.target.value)} />
            </div>
          </FormGrid>
        )}

        {step === 1 && (
          <FormGrid min={220}>
            <div className="field-group">
              <span className="field-label">Location *</span>
              <input className="field-input" autoFocus value={a.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Westlands, Nairobi" />
            </div>
            <div className="field-group">
              <span className="field-label">Kenya site profile</span>
              <select className="field-input" value={a.siteProfile} onChange={(e) => set("siteProfile", e.target.value)}>
                <option value="">— select later —</option>
                {siteProfileNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="field-group">
              <span className="field-label">Site type</span>
              <select className="field-input" value={a.siteType} onChange={(e) => set("siteType", e.target.value)}>
                {["Residential", "Commercial", "Industrial", "Farm / Agricultural", "School", "Hospital / Clinic"].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="field-group">
              <span className="field-label">Electrical phase</span>
              <select className="field-input" value={a.phase} onChange={(e) => set("phase", e.target.value)}>
                <option value="">— select later —</option>
                <option>Single Phase (230V)</option>
                <option>Three Phase (400V)</option>
              </select>
            </div>
            <div className="field-group">
              <span className="field-label">Monthly bill (KES, optional)</span>
              <input type="number" className="field-input" value={a.monthlyBill || ""} onChange={(e) => set("monthlyBill", Math.max(0, Number(e.target.value) || 0))} placeholder="0" />
            </div>
          </FormGrid>
        )}

        {step === 2 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "0.6rem" }}>
            {PROJECT_OBJECTIVES.map((o) => (
              <button key={o.key} onClick={() => set("objectiveKey", o.key)}
                style={{ textAlign: "left", padding: "0.8rem 0.9rem", borderRadius: "var(--radius-md)", cursor: "pointer", font: "inherit",
                  border: `1.5px solid ${a.objectiveKey === o.key ? "var(--color-primary)" : "#e2e8f0"}`,
                  background: a.objectiveKey === o.key ? "#ecfdf5" : "#fff" }}>
                <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "var(--text-main)" }}>{o.label}</div>
                <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "0.15rem", lineHeight: 1.45 }}>{o.hint}</div>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "0.6rem" }}>
            {LOAD_SOURCES.map((s) => (
              <button key={s.key} onClick={() => set("loadSourceKey", s.key)}
                style={{ textAlign: "left", padding: "0.8rem 0.9rem", borderRadius: "var(--radius-md)", cursor: "pointer", font: "inherit",
                  border: `1.5px solid ${a.loadSourceKey === s.key ? "var(--color-primary)" : "#e2e8f0"}`,
                  background: a.loadSourceKey === s.key ? "#ecfdf5" : "#fff" }}>
                <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "var(--text-main)" }}>{s.label}</div>
                <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "0.15rem", lineHeight: 1.45 }}>{s.hint}</div>
              </button>
            ))}
          </div>
        )}

        {step === 4 && (
          <div>
            <ResponsiveDataTable
              stickyHeader={false}
              columns={[{ key: "k", label: "Setting" }, { key: "v", label: "Value", bold: true }]}
              rows={[
                { k: "Client", v: a.client || "—" },
                { k: "Contact", v: a.contact || "—" },
                { k: "Prepared by", v: a.preparedBy || "—" },
                { k: "Location", v: a.location || "—" },
                { k: "Site profile", v: a.siteProfile || "Not set" },
                { k: "Site type", v: a.siteType || "Not set" },
                { k: "Phase", v: a.phase || "Not set" },
                { k: "Monthly bill", v: a.monthlyBill ? money(a.monthlyBill) : "Not set" },
                { k: "Objective", v: objective ? objective.label : "—" },
                { k: "System type", v: objective ? objective.systemType : "—" },
                { k: "Load source", v: source ? source.label : "—" },
              ]}
              getRowKey={(r) => r.k}
            />
            <WarningPanel tone="info">
              Engineering defaults (module electricals, loss factors, indicative costs) are pre-filled and can be
              adjusted in Project Setup. This is a feasibility tool — final engineering approval is still required.
            </WarningPanel>
          </div>
        )}

        <ActionBar>
          {step > 0 && <button onClick={() => setStep((s) => s - 1)} className="btn btn-secondary">← Back</button>}
          {step < WIZARD_STEPS.length - 1 && (
            <button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance} className="btn btn-primary">
              Next →
            </button>
          )}
          {step === WIZARD_STEPS.length - 1 && (
            <button onClick={() => onCreate(a)} className="btn btn-primary">✓ Create Project</button>
          )}
          {!canAdvance && step < 4 && (
            <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
              {step === 0 ? "Enter a client name to continue." : step === 1 ? "Enter a location to continue." : "Choose an option to continue."}
            </span>
          )}
        </ActionBar>
      </Card>
    </div>
  );
}

/* ─── AI ASSISTANT — v11.4 (Internal Alpha) ─────────────────────────────
   The Anthropic key lives ONLY in the Vercel serverless function
   (api/assistant.js). This component never sees it and never calls Anthropic
   directly. Without a configured key the panel degrades to a clear notice and
   the rest of the app is unaffected.
   ──────────────────────────────────────────────────────────────────────── */

const ASSISTANT_CHAT_KEY = "voltflowAssistantChat";

const ASSISTANT_SUGGESTIONS = [
  "Explain this sizing in simple client language.",
  "What are the biggest project risks?",
  "What data is missing before proposal?",
  "Summarize this project for manager approval.",
  "Explain the battery backup expectation.",
  "What should the technician check on site?",
  "Explain the warnings on this project.",
  "Is this project ready to send?",
];

function isAssistantExternallyEnabled(viewMode) {
  if (viewMode === "bank") return false;
  if (typeof window === "undefined") return false;
  return window.__VOLTFLOW_AI_ENABLED__ === true;
}

function assistantDestinationDomain() {
  try {
    if (typeof window === "undefined") return "";
    return new URL("/api/assistant", window.location.origin).hostname;
  } catch {
    return "";
  }
}

function loadAssistantChat() {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(ASSISTANT_CHAT_KEY) || "[]";
    if (raw.length * 2 > 256 * 1024) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((m) => m && typeof m.content === "string").slice(-40) : [];
  } catch {
    return [];
  }
}

function persistAssistantChat(messages) {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ASSISTANT_CHAT_KEY, JSON.stringify(messages.slice(-40)));
    }
  } catch { /* chat history is best-effort only */ }
}

/* ─── PROJECT ADVISOR — v11.5.1 (rule-based, no Claude) ─────────────────────
   Works with or without ANTHROPIC_API_KEY. Summarises what the app already
   computed into plain guidance. Advisory only — not engineering approval. */
// v11.5.2 — Project Advisor now reads the CENTRAL readiness engine, so the
// Advisor, Dashboard and Action Center always agree (single source of truth).
// Works with or without the Claude API key. Next actions and blockers are
// clickable and route to the exact tab/field via navigateToTab.
function ProjectAdvisorPanel({ readiness, navigateToTab, previousView, onBack }) {
  if (!readiness) return null;
  const engReview = readiness.criticalIssues.length > 0;
  const verdictTone = engReview ? "danger" : readiness.readyForProposal ? "success" : "warning";
  const verdict = engReview
    ? "Engineering review required before this can be quoted."
    : readiness.readyForProposal
      ? "Ready — safe to prepare the proposal (review every number first)."
      : "In progress — clear the items below before proposing.";
  const status = engReview ? "Engineering review required" : readiness.readyForProposal ? "Ready to propose" : "In progress";
  const go = (tab, hid) => tab && navigateToTab && navigateToTab(tab, { source: "advisor", highlightId: hid });
  const requiredMissing = (readiness.missingFields || []).filter((m) => m.priority !== "recommended");
  const nightWarn = readiness.night?.nightAutonomyWarning && readiness.night.nightEnergyCoverage < 1
    ? readiness.night.nightAutonomyWarning : null;
  return (
    <Card title="📋 Project Advisor" subtitle="Rule-based guidance from your current project — the same source the Dashboard and Action Center use. Always available; no AI key required.">
      {previousView && onBack && (
        <button className="vf-back-btn" onClick={onBack} style={{ marginBottom: "0.5rem" }}>← Back</button>
      )}
      <WarningPanel tone={verdictTone} title={verdict}>
        {`Readiness ${readiness.overallScore}/100 · ${status}${readiness.criticalIssues.length > 0 ? ` · ${readiness.criticalIssues.length} critical blocker(s)` : ""} · ${requiredMissing.length} required item(s) outstanding.`}
      </WarningPanel>

      <div className="grid-cols-2" style={{ marginTop: "0.25rem" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: "0.8rem", color: "var(--text-main)", margin: "0.25rem 0 0.4rem" }}>Next 3 actions</div>
          {readiness.nextActions.length === 0 ? (
            <div style={{ fontSize: "0.84rem", color: "var(--text-medium)" }}>Nothing outstanding — every core section is complete.</div>
          ) : (
            <ol style={{ margin: 0, paddingLeft: "1.15rem", fontSize: "0.84rem", color: "var(--text-medium)", lineHeight: 1.8 }}>
              {readiness.nextActions.map((a, i) => (
                <li key={i}>
                  {a.actionTab && navigateToTab ? (
                    <button onClick={() => go(a.actionTab, a.highlightId)} className="vf-link-btn">{a.label} →</button>
                  ) : a.label}
                </li>
              ))}
            </ol>
          )}
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: "0.8rem", color: "var(--text-main)", margin: "0.25rem 0 0.4rem" }}>Decisions</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <StatusPill tone={engReview ? "danger" : "success"}>
              {engReview ? "⚠ Engineering review required" : "✓ No engineering blockers"}
            </StatusPill>
            <StatusPill tone={readiness.readyForProposal ? "success" : "neutral"}>
              {readiness.readyForProposal ? "✓ Proposal safe to generate" : "○ Not ready for proposal"}
            </StatusPill>
            <StatusPill tone={readiness.readyForClientView ? "success" : "neutral"}>
              {readiness.readyForClientView ? "✓ Client-friendly proposal recommended" : "○ Client proposal: hold"}
            </StatusPill>
          </div>
        </div>
      </div>

      {readiness.criticalIssues.length > 0 && (
        <div style={{ marginTop: "0.85rem" }}>
          <div style={{ fontWeight: 800, fontSize: "0.8rem", color: "var(--text-main)", marginBottom: "0.4rem" }}>Critical blockers ({readiness.criticalIssues.length})</div>
          {readiness.criticalIssues.map((c, i) => (
            c.actionTab && navigateToTab
              ? <button key={i} onClick={() => go(c.actionTab, c.highlightId)} className="vf-badge-btn"><SimBadge level="danger">{c.label} →</SimBadge></button>
              : <SimBadge key={i} level="danger">{c.label}</SimBadge>
          ))}
        </div>
      )}
      {nightWarn && (
        <div style={{ marginTop: "0.6rem" }}>
          <div style={{ fontWeight: 800, fontSize: "0.8rem", color: "var(--text-main)", marginBottom: "0.4rem" }}>Night-load caution</div>
          <SimBadge level="warning">{nightWarn}</SimBadge>
        </div>
      )}
      {requiredMissing.length > 0 && (
        <div style={{ marginTop: "0.6rem" }}>
          <div style={{ fontWeight: 800, fontSize: "0.8rem", color: "var(--text-main)", marginBottom: "0.4rem" }}>Missing / to review ({requiredMissing.length})</div>
          {requiredMissing.slice(0, 8).map((m, i) => (
            m.actionTab && navigateToTab
              ? <button key={i} onClick={() => go(m.actionTab, m.highlightId)} className="vf-badge-btn"><SimBadge level="warning">{m.section}: {m.item} →</SimBadge></button>
              : <SimBadge key={i} level="warning">{m.section}: {m.item}</SimBadge>
          ))}
        </div>
      )}
      <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "0.6rem" }}>
        Advisory only — verify technical and commercial decisions, and get qualified engineering review, before use.
      </div>
    </Card>
  );
}

const MARKET_CHECKLIST_KEY = "voltflowDemoChecklist";

function MarketReadinessCard({ feedbackCount = 0 }) {
  const [manual, setManual] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(MARKET_CHECKLIST_KEY) || "{}"); } catch { return {}; }
  });
  const setItem = (k, v) => {
    const next = { ...manual, [k]: v };
    setManual(next);
    try { localStorage.setItem(MARKET_CHECKLIST_KEY, JSON.stringify(next)); } catch { /* best effort */ }
  };
  // Some items are auto-detected; the rest are tester-confirmed.
  const items = [
    { k: "cleanStartup", label: "Clean startup active (no fake project on open)", auto: true },
    { k: "noAutoDemo", label: "No demo auto-loaded", auto: true },
    { k: "disclaimer", label: "Engineering disclaimer visible in proposal", auto: true },
    { k: "feedback", label: "Feedback submitted", auto: feedbackCount > 0 },
    { k: "loads", label: "Load assessment tested", auto: false },
    { k: "energy", label: "Energy import tested", auto: false },
    { k: "proposal", label: "Proposal generated (PDF opened)", auto: false },
    { k: "saveExport", label: "Save / export done", auto: false },
  ];
  const done = items.filter((i) => i.auto || manual[i.k]).length;

  return (
    <Card title="Market readiness / demo checklist"
      subtitle="A quick pre-demo pass. Auto-ticked items are detected; tick the rest as you test.">
      <div style={{ fontSize: "0.85rem", color: "var(--text-medium)", lineHeight: 1.6, marginBottom: "0.85rem", padding: "0.6rem 0.85rem", background: "var(--bg-main)", border: "1px solid var(--border-medium)", borderRadius: "var(--radius-md)" }}>
        <strong>What Voltflow does:</strong> Voltflow helps solar teams move from site survey and load assessment to
        feasibility sizing, proposal preparation, installer planning and project workflow testing.
      </div>
      <div style={{ height: "8px", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden", marginBottom: "0.85rem" }}>
        <div style={{ width: `${Math.round((done / items.length) * 100)}%`, height: "100%", background: done === items.length ? "var(--color-primary)" : "#f59e0b", transition: "width .3s ease" }} />
      </div>
      {items.map((i) => (
        <label key={i.k} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0", fontSize: "0.85rem", cursor: i.auto ? "default" : "pointer", color: (i.auto || manual[i.k]) ? "var(--text-muted)" : "var(--text-main)" }}>
          <input type="checkbox" checked={i.auto || !!manual[i.k]} disabled={i.auto}
            onChange={(e) => setItem(i.k, e.target.checked)} style={{ width: "17px", height: "17px", accentColor: "var(--color-primary)" }} />
          <span style={{ textDecoration: (i.auto || manual[i.k]) ? "line-through" : "none" }}>{i.label}</span>
          {i.auto && <StatusPill tone="success">auto</StatusPill>}
        </label>
      ))}
      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.6rem" }}>
        {done}/{items.length} complete. Voltflow Internal Alpha — for controlled testing, not a production SaaS or certified engineering tool.
      </div>
    </Card>
  );
}

function AssistantPanel({ assistantContext, readiness, navigateToTab, previousView, onBack, showToast, viewMode }) {
  const { cloudEnabled, session, activeMembership } = useVoltflowPlatform();
  const [messages, setMessages] = useState(() => cloudEnabled ? [] : loadAssistantChat());
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const logRef = useRef(null);
  const aiEnabled = isAssistantExternallyEnabled(viewMode);
  const bankMode = viewMode === "bank";
  const destinationDomain = aiEnabled ? assistantDestinationDomain() : "";

  useEffect(() => { if (!cloudEnabled) persistAssistantChat(messages); }, [messages, cloudEnabled]);
  useEffect(() => { if (cloudEnabled) setMessages([]); }, [cloudEnabled, activeMembership?.organisationId]);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, busy]);

  const send = async (text) => {
    const question = (text ?? input).trim();
    if (!question || busy) return;
    setInput("");
    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: question, at: new Date().toISOString() }]);
    if (!aiEnabled) {
      setNotConfigured(true);
      setMessages((m) => [...m, { role: "error", content: bankMode ? "AI Assistant is disabled in Bank Mode. Use Project Advisor for local rule-based guidance." : "AI Assistant is disabled in this environment. Project Advisor above is still available for rule-based guidance.", at: new Date().toISOString() }]);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cloudEnabled && session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          message: question,
          context: assistantContext,
          history,
          organisationId: cloudEnabled ? activeMembership?.organisationId : undefined,
        }),
      });
      // A non-JSON response means the function isn't deployed (e.g. plain Vite dev)
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        setNotConfigured(true);
        setMessages((m) => [...m, { role: "error", content: "AI Assistant is not enabled in this environment. Project Advisor above is still available for rule-based guidance.", at: new Date().toISOString() }]);
        return;
      }
      const data = await res.json();
      if (data.configured === false) {
        setNotConfigured(true);
        setMessages((m) => [...m, { role: "error", content: "AI Assistant is not enabled in this environment. Project Advisor above is still available for rule-based guidance.", at: new Date().toISOString() }]);
        return;
      }
      setNotConfigured(false);
      if (data.error) {
        setMessages((m) => [...m, { role: "error", content: data.error, at: new Date().toISOString() }]);
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: data.reply, at: new Date().toISOString() }]);
    } catch {
      setMessages((m) => [...m, { role: "error", content: "Could not reach the assistant service. Check your connection and try again.", at: new Date().toISOString() }]);
    } finally {
      setBusy(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    persistAssistantChat([]);
    if (showToast) showToast("Assistant chat cleared for this browser.");
  };

  return (
    <div className="vf-page-enter" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <PageHeader
        eyebrow="Voltflow Internal Alpha"
        title="Assistant & Advisor"
        description="Project Advisor gives rule-based guidance from your current project - always available. Optional AI Q&A only runs when explicitly enabled. Neither can change your project values."
      />

      {/* Rule-based advisor first — works with or without the AI key.
          v11.5.2: reads the central readiness engine so it agrees with Dashboard + Action Center. */}
      <ProjectAdvisorPanel readiness={readiness} navigateToTab={navigateToTab} previousView={previousView} onBack={onBack} />

      {(!aiEnabled || notConfigured) && (
        <WarningPanel tone="info" title={bankMode ? "AI Assistant is disabled in Bank Mode" : "AI Assistant is not enabled in this environment"}>
          <strong>Project Advisor</strong> above still works — it gives rule-based guidance and needs no setup.
          Optional AI Q&A can be enabled by an administrator for engineer use; everything else in Voltflow continues to work normally.
        </WarningPanel>
      )}

      <Card title="AI Assistant" subtitle="Optional free-form Q&A when enabled. Chat history is stored in this browser only and is cleared when you clear site data.">
        <div ref={logRef} className="vf-chat-log">
          {messages.length === 0 && !busy && (
            <EmptyState
              icon="💬"
              title="No questions yet"
              description="Pick a suggested question below, or type your own. The assistant sees only a limited project summary — never your saved projects, feedback, or personal survey details."
            />
          )}
          {messages.map((m, i) => (
            <div key={i}
              className={`vf-chat-msg vf-fade-in ${m.role === "user" ? "vf-chat-user" : m.role === "error" ? "vf-chat-error" : "vf-chat-assistant"}`}>
              {m.content}
            </div>
          ))}
          {busy && (
            <div className="vf-chat-msg vf-chat-assistant" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Spinner /> Thinking…
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.85rem", alignItems: "flex-end" }}>
          <textarea
            className="field-input"
            rows={2}
            value={input}
            placeholder="Ask about this project…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            style={{ flex: 1, resize: "vertical" }}
          />
          <button onClick={() => send()} className="btn btn-primary" disabled={busy || !input.trim()}>
            {busy ? <><Spinner /> Sending</> : "Send"}
          </button>
        </div>
        {aiEnabled && destinationDomain && (
          <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "0.4rem" }}>
            Destination domain: {destinationDomain}
          </div>
        )}

        <ActionBar>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700 }}>Suggested:</span>
          {ASSISTANT_SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} disabled={busy}
              style={{ padding: "0.3rem 0.7rem", borderRadius: "1rem", fontSize: "0.76rem", fontWeight: 600,
                cursor: busy ? "not-allowed" : "pointer", border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569" }}>
              {s}
            </button>
          ))}
          {messages.length > 0 && (
            <button onClick={clearChat} className="btn btn-secondary" style={{ marginLeft: "auto", fontSize: "0.78rem" }}>
              Clear chat
            </button>
          )}
        </ActionBar>
      </Card>

      <Card title="What the assistant sees" subtitle="Exactly this summary is sent with each question — nothing else.">
        <ResponsiveDataTable
          compact
          stickyHeader={false}
          columns={[
            { key: "field", label: "Field" },
            { key: "value", label: "Value sent" },
          ]}
          rows={Object.entries(assistantContext || {})
            .filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0))
            .map(([k, v]) => ({ field: k, value: Array.isArray(v) ? `${v.length} item(s)` : String(v) }))}
          getRowKey={(r) => r.field}
        />
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.4rem" }}>
          Never sent: saved project list, tester feedback, browser storage contents, survey photos, phone/meter numbers or GPS coordinates.
        </div>
      </Card>

      <WarningPanel tone="info" title="Advisory only">
        {ASSISTANT_DISCLAIMER} The assistant does not provide certified engineering advice, and cannot approve designs,
        guarantee KPLC/EPRA outcomes, or confirm carbon revenue. Final engineering design and installation approval
        require qualified review.
      </WarningPanel>
    </div>
  );
}

/* ─── TESTER FEEDBACK — v11.3 (Internal Alpha) ──────────────────────────── */

const FEEDBACK_TAB_OPTIONS = [
  "Dashboard", "Sizing Overview", "Site Survey", "Roof & Shading", "Roof Layout", "Electrical",
  "Site Photos", "Safety & Risks", "Project Setup", "Load Assessment", "Energy Data Import",
  "PV + PR", "Battery", "Inverter + Safety", "Eng. Compliance", "System Options",
  "Financials + DSCR", "Carbon Credits", "Installer Simulation", "Accessories / BOS",
  "BoQ", "Proposal", "Project Readiness", "Save / Load", "Other",
];

function FeedbackPanel({ buildSnapshot, showToast }) {
  const [entries, setEntries] = useState(() => loadFeedbackLocal());
  const [form, setForm] = useState({
    testerName: "",
    role: "Technician",
    pageTab: "Load Assessment",
    issueType: FEEDBACK_ISSUE_TYPES[0],
    description: "",
    includeSnapshot: false,
    deviceNote: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 160) : "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.description.trim()) { showToast("Describe the issue before submitting.", "error"); return; }
    if (!form.testerName.trim()) { showToast("Add your name so we can follow up.", "error"); return; }
    const entry = {
      testerName: form.testerName.trim(),
      role: form.role,
      pageTab: form.pageTab,
      issueType: form.issueType,
      description: form.description.trim(),
      deviceNote: form.deviceNote,
      appVersion: APP_VERSION,
      projectSnapshot: form.includeSnapshot && buildSnapshot ? buildSnapshot() : null,
    };
    const { records, persisted } = addFeedbackLocal(entry, entries);
    setEntries(records);
    setForm((f) => ({ ...f, description: "", includeSnapshot: false }));
    showToast(persisted
      ? "Feedback saved on this device — use Export Feedback JSON to send it to the Voltflow team."
      : "Feedback kept for this session only (browser storage full) — export it now.", persisted ? "success" : "error");
  };

  const exportAll = () => {
    if (entries.length === 0) { showToast("No feedback to export yet.", "error"); return; }
    const { filename, jsonString } = exportFeedbackJson(entries, APP_VERSION);
    const blob = new Blob([jsonString], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Card title="Send Feedback / Report Issue"
        subtitle="Voltflow Internal Alpha — feedback is stored on this device; export it as JSON and share it with the Voltflow team (e.g. WhatsApp/email).">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.6rem", marginBottom: "0.75rem" }}>
          <div className="field-group">
            <span className="field-label">Your name *</span>
            <input className="field-input" value={form.testerName} onChange={(e) => set("testerName", e.target.value)} />
          </div>
          <div className="field-group">
            <span className="field-label">Role</span>
            <select className="field-input" value={form.role} onChange={(e) => set("role", e.target.value)}>
              {["Technician", "Sales engineer", "Design engineer", "Manager", "Client/tester", "Other"].map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="field-group">
            <span className="field-label">Page / tab where it happened</span>
            <select className="field-input" value={form.pageTab} onChange={(e) => set("pageTab", e.target.value)}>
              {FEEDBACK_TAB_OPTIONS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="field-group">
            <span className="field-label">Issue type</span>
            <select className="field-input" value={form.issueType} onChange={(e) => set("issueType", e.target.value)}>
              {FEEDBACK_ISSUE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="field-group" style={{ marginBottom: "0.6rem" }}>
          <span className="field-label">Description * (what happened, what you expected, numbers if it's a calculation concern)</span>
          <textarea className="field-input" rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div className="field-group" style={{ marginBottom: "0.6rem" }}>
          <span className="field-label">Browser / device note</span>
          <input className="field-input" value={form.deviceNote} onChange={(e) => set("deviceNote", e.target.value)} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", color: "#475569", marginBottom: "0.75rem", cursor: "pointer" }}>
          <input type="checkbox" checked={form.includeSnapshot} onChange={(e) => set("includeSnapshot", e.target.checked)} style={{ accentColor: "var(--color-primary)" }} />
          Attach a snapshot of the current project JSON (helps reproduce calculation issues)
        </label>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button onClick={submit} className="btn btn-primary">📨 Submit feedback</button>
          <button onClick={exportAll} className="btn btn-secondary">📥 Export Feedback JSON ({entries.length})</button>
        </div>
      </Card>

      <Card title={`Feedback stored on this device (${entries.length})`} subtitle="Newest first. Deleting here cannot be undone.">
        {entries.length === 0 ? (
          <EmptyState icon="📝" title="No feedback recorded yet"
            description="Submit a report above and it will be listed here, ready to export as JSON for the Voltflow team." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {entries.map((f) => (
              <div key={f.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "0.6rem 0.85rem", fontSize: "0.82rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span><b>{f.issueType}</b> · {f.pageTab} · {f.testerName} ({f.role})</span>
                  <span style={{ color: "var(--text-muted)" }}>
                    {new Date(f.submittedAt).toLocaleString()}
                    {f.projectSnapshot ? " · 📎 snapshot" : ""}
                    <button onClick={() => setEntries(deleteFeedbackLocal(f.id, entries))}
                      style={{ marginLeft: "0.6rem", border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", fontWeight: 700 }}>✕</button>
                  </span>
                </div>
                <div style={{ color: "#334155", marginTop: "0.25rem", whiteSpace: "pre-wrap" }}>{f.description}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* v11.5.1 — pre-demo readiness checklist for EPC/client walkthroughs */}
      <MarketReadinessCard feedbackCount={entries.length} />

      <AlertBox type="info">
        Voltflow Internal Alpha — controlled testing and development build. Feedback stays on this device until exported; there is no automatic cloud submission yet.
      </AlertBox>
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  const bg = toast.type === "error" ? "#fef2f2" : "#ecfdf5";
  const border = toast.type === "error" ? "#fca5a5" : "#6ee7b7";
  const color = toast.type === "error" ? "#7f1d1d" : "#065f46";
  return (
    <div role={toast.type === "error" ? "alert" : "status"} aria-atomic="true" style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 9999, padding: "0.85rem 1.25rem", borderRadius: "0.5rem", border: `1px solid ${border}`, backgroundColor: bg, color, fontSize: "0.9rem", fontWeight: 600, boxShadow: "0 4px 12px rgba(0,0,0,0.12)", maxWidth: "min(360px, calc(100vw - 3rem))" }}>
      {toast.msg}
    </div>
  );
}

export default function SolariseProSizingApp() {
  const platformContext = useVoltflowPlatform();
  const { platform, cloudEnabled, activeMembership } = platformContext;
  const enforceRoleAccess = cloudEnabled && !!activeMembership;
  const actorRole = activeMembership?.role || "engineer";
  const [safeMode] = useState(isSafeModeRequested);
  // Dev-only loop diagnostics behind ?debugPerf=1 (no effect in normal use).
  // Counts App renders and the two setProject-bearing effects so a render loop
  // shows up as an exploding count on window.__vfPerf instead of guesswork.
  const perf = React.useRef({ render: 0, designRevision: 0, surveySync: 0 });
  perf.current.render += 1;
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debugPerf") === "1") {
    window.__vfPerf = perf.current;
  }
  const [project, setProjectState] = useState(defaultProject);
  const setProject = useCallback((next) => setProjectState((current) => resolveEquipmentProject(typeof next === "function" ? next(current) : next)), []);
  // v10 — loadItemsV2 is the single source of truth for load data. Draft
  // pattern (edits stay in draftLoadItemsV2 until "Update Sizing") preserved
  // from v8.3's loads/draftLoads.
  const [loadAssessmentMode, setLoadAssessmentMode] = useState("Residential");
  const [loadItemsV2, setLoadItemsV2] = useState(() => migrateLegacyLoadsToV2(defaultLoads));
  const [draftLoadItemsV2, setDraftLoadItemsV2] = useState(() => migrateLegacyLoadsToV2(defaultLoads));
  const [hasUnappliedLoadChanges, setHasUnappliedLoadChanges] = useState(false);
  const [accessoriesAssumptions, setAccessoriesAssumptions] = useState(defaultAccessoriesAssumptions);
  const [accessoryOverrides, setAccessoryOverrides] = useState(() => normalizeAccessoryOverrides());
  const [accessoriesCatalogue, setAccessoriesCatalogue] = useState(() => DEFAULT_CATALOGUE);
  // v11 — stable per-project reference + Voltflow Copilot history
  const [projectRef, setProjectRef] = useState(() => generateProjectRef());
  const [copilotHistory, setCopilotHistory] = useState(() => normalizeCopilotHistory());
  const [copilotLastReview, setCopilotLastReview] = useState(() => normalizeCopilotLastReview());
  const [survey, setSurvey] = useState(defaultSurvey);
  const [simulation, setSimulation] = useState(defaultSimulation);
  const [savedProjects, setSavedProjects] = useState(() => cloudEnabled || safeMode ? [] : loadProjectsLocal());
  const [localProjectRecovery, setLocalProjectRecovery] = useState(() => safeMode ? null : getLocalProjectRecovery());
  const [cloudProjectRecord, setCloudProjectRecord] = useState(null);
  const [active, setActive] = useState("field-dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    document.querySelector("#workspace-sidebar button, #workspace-sidebar input")?.focus();
    const closeSidebarOnEscape = (event) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
        document.getElementById("workspace-menu-toggle")?.focus();
      }
      if (event.key === "Tab") {
        const controls = Array.from(document.querySelectorAll("#workspace-menu-toggle, #workspace-sidebar button, #workspace-sidebar input"))
          .filter((element) => !element.disabled && element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", closeSidebarOnEscape);
    return () => window.removeEventListener("keydown", closeSidebarOnEscape);
  }, [sidebarOpen]);
  // v11.5.2 — guided navigation: remember where the user came from (for Back),
  // a transient highlight target, and the Action Center drawer.
  const [previousView, setPreviousView] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [actionCenterOpen, setActionCenterOpen] = useState(false);
  // v11.4.1 — clean startup. No project is active until the user creates,
  // loads, imports or explicitly picks a demo. `startupView` drives which
  // entry screen is shown while hasActiveProject is false.
  const [hasActiveProject, setHasActiveProject] = useState(false);
  const [hasPausedWorkspace, setHasPausedWorkspace] = useState(false);
  const [startupView, setStartupView] = useState("welcome"); // welcome | wizard | demos
  useEffect(() => {
    const workspace = document.getElementById("workspace-main");
    workspace?.focus({ preventScroll: true });
    workspace?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [active, hasActiveProject, startupView]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 992px)");
    const closeDesktopMenu = () => { if (desktop.matches) setSidebarOpen(false); };
    desktop.addEventListener("change", closeDesktopMenu);
    return () => desktop.removeEventListener("change", closeDesktopMenu);
  }, []);
  const [pendingDemoConversion, setPendingDemoConversion] = useState(false);
  // v11.4 — presentation mode (engineer | client | technician). Stored on the
  // project so it round-trips through save/load; never affects calculations.
  const viewMode = normalizeViewMode(project.viewMode);
  const setViewMode = (mode) => setProject((p) => ({ ...p, viewMode: normalizeViewMode(mode) }));

  // v10 — adapter into the existing (unmodified) sizing engine. This is the
  // ONLY place loadItemsV2 is projected into the legacy flat load shape.
  const derivedLoads = useMemo(
    () => toLegacyLoads(loadItemsV2, loadAssessmentMode),
    [loadItemsV2, loadAssessmentMode]
  );
  const sizing = useSizing(project, derivedLoads);
  const batteryHardware = useMemo(() => {
    const selection = normalizeBatterySelection(project.batterySelection);
    const selectedAsset = selection.selection_mode === "MANUAL" ? getAsset(selection.asset_id) : null;
    const asset = selectedAsset || {
      id: "AUTO",
      nominal_kwh: project.batteryModuleKwh,
      usable_dod: project.dod,
      nominal_voltage: project.batteryVoltage,
      bank_continuous_discharge_a: sizing.bmsMaxDischargeA,
      max_parallel_units: 100,
    };
    const inverterAsset = getAsset(project.inverterSelection?.asset_id);
    return deriveBatterySelection(
      { required_usable_kwh: sizing.backupEnergyNeed, required_power_kw: sizing.peakKw, average_backup_kw: sizing.backupEnergyNeed / Math.max(project.backupHours || 1, 1) },
      selection,
      asset,
      inverterAsset || { battery_voltage_min: project.batteryVoltage * 0.8, battery_voltage_max: project.batteryVoltage * 1.25 },
    );
  }, [project.batterySelection, project.batteryModuleKwh, project.dod, project.batteryVoltage, project.backupHours, project.inverterSelection, sizing.backupEnergyNeed, sizing.peakKw, sizing.bmsMaxDischargeA]);
  const billLoadReconciliation = useMemo(() => reconcileBillAndLoads({
    monthlyBillKes: project.monthlyBill,
    tariffKesPerKwh: project.gridTariff,
    itemizedDailyKwh: sizing.dailyKwh,
    monthlySavingsKes: sizing.monthlySavings,
    nonEnergyChargesKes: project.nonEnergyChargesKes || 0,
    nonEnergyChargesKnown: project.nonEnergyChargesKnown === true,
    measuredMonthlyKwh: sizing.tariffModel?.ready ? sizing.tariffModel.referenceKwh : null,
    billingDays: sizing.tariffModel?.ready ? sizing.tariffModel.billingDays : 30,
  }), [project.monthlyBill, project.gridTariff, project.nonEnergyChargesKes, project.nonEnergyChargesKnown, sizing.dailyKwh, sizing.monthlySavings, sizing.tariffModel]);
  const loadSummary = useMemo(
    () => summarizeLoads(loadItemsV2, loadAssessmentMode, project),
    [loadItemsV2, loadAssessmentMode, project]
  );
  const loadWarnings = useMemo(
    () => getLoadWarnings(loadItemsV2, loadAssessmentMode, loadSummary, project),
    [loadItemsV2, loadAssessmentMode, loadSummary, project]
  );
  const dataLoggerRecommendation = useMemo(
    () => getDataLoggerRecommendation(loadAssessmentMode),
    [loadAssessmentMode]
  );
  const loadProfile24h = useMemo(
    () => computeLoadProfile24h(loadItemsV2, loadAssessmentMode, sizing),
    [loadItemsV2, loadAssessmentMode, sizing]
  );

  // Roof geometry & panel layout — computed from live survey + project + sizing
  const roofGeometry  = useMemo(() => calculateRoofGeometry(survey, project), [survey, project]);
  const panelLayout   = useMemo(() => estimatePanelLayout(project, sizing, roofGeometry), [project, sizing, roofGeometry]);
  const tiltGuidance  = useMemo(() => recommendPanelTiltAndOrientation(project, survey, roofGeometry), [project, survey, roofGeometry]);
  const rowSpacing    = useMemo(() => estimateRowSpacing(project.panelLengthM || 2.28, roofGeometry.roofPitchDeg || survey.roofPitch || 15), [project.panelLengthM, roofGeometry.roofPitchDeg, survey.roofPitch]);
  const installerTips = useMemo(() => getInstallerTips(survey, project), [survey, project]);
  const roofWarnings  = useMemo(() => getRoofInstallationWarnings(survey, roofGeometry, panelLayout), [survey, roofGeometry, panelLayout]);
  const blueprintAdvice = useMemo(() => project.sizingMode === "blueprint_new_build" ? getBlueprintConstructionAdvice() : [], [project.sizingMode]);
  // v8.4 — Installer simulation warnings (live, used by Dashboard + SystemOptions)
  const simWarnings = useMemo(() => getSimulationWarnings(project, survey, simulation, panelLayout, roofGeometry), [project, survey, simulation, panelLayout, roofGeometry]);

  // v8.5 — Multi-roof distribution (live, used by SystemOptions + InstallerSimulation)
  const activeFaces = useMemo(() => {
    const faces = simulation.roofFaces && simulation.roofFaces.length > 0
      ? simulation.roofFaces
      : initRoofFacesFromSurvey(survey, project);
    return faces.map(normalizeRoofFace);
  }, [
    simulation.roofFaces,
    survey.roofLengthM, survey.roofWidthM, survey.roofPitch, survey.roofAzimuthDeg,
    survey.roofUsablePercent, survey.roofType, survey.roofCondition,
    project.blueprintRoofLengthM, project.blueprintRoofWidthM,
    project.blueprintRoofPitchDeg, project.roofUsablePercent,
  ]);

  const multiRoofDist = useMemo(
    () => distributeAcrossRoofFaces(activeFaces, project, sizing.panels || 0),
    [activeFaces, project, sizing.panels]
  );

  // v8.5 — String plan (only generated when user requests or simulation.stringPlan is set)
  const liveStringPlan = useMemo(
    () => simulation.stringPlan || generateStringPlan(project, sizing, activeFaces),
    [simulation.stringPlan, project, sizing, activeFaces]
  );

  // v8.5 — As-built comparison (v11.1: cable estimates enable planned-vs-actual cable checks)
  const asBuiltIssues = useMemo(
    () => compareAsBuilt(liveStringPlan, simulation.asBuilt || {}, getCableEstimates(simulation, project, roofGeometry)),
    [liveStringPlan, simulation, project, roofGeometry]
  );

  // v10 — Accessories/BOS: auto-generated from the same layout/string/cable
  // state everything else already uses, then user overrides merged on top.
  // Recomputed on every relevant change, so it's "real-time" by construction.
  const autoAccessoriesBoQ = useMemo(
    () => generateAccessoriesBoQ({ project, survey, sizing, roofGeometry, panelLayout, simulation, liveStringPlan, accessoriesAssumptions, catalogue: accessoriesCatalogue }),
    [project, survey, sizing, roofGeometry, panelLayout, simulation, liveStringPlan, accessoriesAssumptions, accessoriesCatalogue]
  );
  const accessoriesBoQ = useMemo(
    () => applyAccessoryOverrides(autoAccessoriesBoQ, accessoryOverrides),
    [autoAccessoriesBoQ, accessoryOverrides]
  );

  // v8: Decision intelligence — computed once, passed down to multiple tabs
  const readiness   = useMemo(
    () => calculateReadiness(project, derivedLoads, survey, sizing, {
      panelLayout,
      stringPlan: liveStringPlan,
      simDangerCount: simWarnings.filter((w) => w.level === "danger").length,
    }),
    [project, derivedLoads, survey, sizing, panelLayout, liveStringPlan, simWarnings]
  );
  const advisory    = useMemo(() => generateAdvisory(project, derivedLoads, survey, sizing, readiness, billLoadReconciliation), [project, derivedLoads, survey, sizing, readiness, billLoadReconciliation]);
  const confidence  = useMemo(() => computeAssumptionConfidence(project, survey), [project, survey]);
  const governance  = useMemo(() => computeGovernanceStatus(project, sizing, readiness), [project, sizing, readiness]);
  // v11.5.2 — central readiness engine: single source of truth for Dashboard,
  // Project Advisor, Action Center and the proposal gate.
  // v11.6 — Solar Borehole feasibility result (feeds readiness, BoQ, proposal, views).
  // Also flags the double-count case: a pump entered both here and in Load Assessment.
  const boreholeResult = useMemo(() => {
    const r = computeBorehole(project.borehole, { psh: project.psh, pr: sizing.pr, panelW: project.panelW });
    if (project.borehole?.enabled && Array.isArray(loadItemsV2) && loadItemsV2.some((l) => /pump|borehole/i.test(l.name || ""))) {
      r.warnings = [...(r.warnings || []), { level: "warning", code: "PUMP_DOUBLE_COUNT", message: "Pump appears in both Load Assessment and the Borehole Module. Confirm whether to include it once or merge — avoid double-counting pump energy." }];
    }
    return r;
  }, [project.borehole, project.psh, sizing.pr, project.panelW, loadItemsV2]);
  const projectReadiness = useMemo(
    () => buildProjectReadiness(project, derivedLoads, draftLoadItemsV2, survey, sizing, simulation, project.delivery, project.energyImport, hasUnappliedLoadChanges, project.borehole?.enabled ? boreholeResult : null),
    [project, derivedLoads, draftLoadItemsV2, survey, sizing, simulation, hasUnappliedLoadChanges, boreholeResult]
  );
  // v11.7 — Voltflow Studio: visual project blocks + Explain-this drawer state.
  const studioBlocks = useMemo(
    () => buildStudioBlocks(projectReadiness, sizing, boreholeResult, !!project.borehole?.enabled),
    [projectReadiness, sizing, boreholeResult, project.borehole]
  );
  const [explainKey, setExplainKey] = useState(null);
  const explainCtx = { project, sizing, borehole: boreholeResult, readiness: projectReadiness };
  const quickWins   = useMemo(() => generateQuickWins(derivedLoads, survey), [derivedLoads, survey]);
  const systemOptions = useMemo(() => {
    // Do not compute design options / revision sizing before a project is active.
    // The entry screen has no project to size, and this keeps all revision-hash
    // work (option inputs_hash) off the startup render path.
    if (!hasActiveProject) return undefined;
    if (project.systemType !== "Solar PV – Hybrid" && project.systemType !== "Off-grid" && project.systemType !== "Genset hybrid") return null;
    const templates = [
      {
        id: "essential", label: "Essential Backup", badge: "budget",
        desc: "Lower cost. Critical loads only. Smaller PV and battery.",
        pros: ["Lower upfront cost", "Smaller footprint", "Good for budget-sensitive clients"],
        cons: ["Less bill reduction", "Shorter backup window", "May not cover all loads"],
        bestFor: "Budget-conscious clients who primarily need backup during outages",
        overrides: { solarCoverage: 0.55, backupHours: 4, autonomyDays: 0.75 },
      },
      {
        id: "balanced", label: "Balanced Solar Saver", badge: "recommended",
        desc: "Recommended system. Good bill reduction and reliable backup.",
        pros: ["Optimised payback", "Covers most loads", "Standard installation"],
        cons: ["May not cover extended outages", "Not full off-grid resilience"],
        bestFor: "Most residential and SME clients seeking value and reliability",
        overrides: {},
      },
      {
        id: "premium", label: "Premium Energy Security", badge: "premium",
        desc: "Maximum resilience. Higher solar, longer backup, greater autonomy.",
        pros: ["Maximum backup window", "Greater energy independence", "Future-proofed"],
        cons: ["Higher upfront cost", "Longer payback", "Requires more space"],
        bestFor: "Clients who value resilience, face frequent outages, or have critical equipment",
        overrides: { solarCoverage: 1.0, backupHours: 14, autonomyDays: 2.5 },
      },
    ];
    return deriveSystemOptions({
      project,
      loads: derivedLoads,
      templates,
      inputsHash: project.designRevision?.inputs_hash || null,
      revisionId: project.designRevision?.revision_id || null,
      calculationVersion: project.designRevision?.calculation_version || DESIGN_CALCULATION_VERSION,
    });
  }, [project, derivedLoads, hasActiveProject]);

  // Sync survey fields → project state so useSizing always reflects field data
  React.useEffect(() => {
    perf.current.surveySync += 1;
    setProject((p) => {
      const mapped = { ...p };
      if (survey.clientName) mapped.client = survey.clientName;
      if (survey.siteAddress) mapped.location = survey.siteAddress;
      if (survey.monthlyBill) mapped.monthlyBill = survey.monthlyBill;
      if (survey.siteType) mapped.siteType = survey.siteType;
      if (survey.phaseType) mapped.phase = survey.phaseType;
      // Map county to site profile
      if (survey.county && countyToSiteProfile[survey.county]) {
        const sp = siteProfiles[countyToSiteProfile[survey.county]];
        if (sp) {
          mapped.siteProfile = countyToSiteProfile[survey.county];
          mapped.psh = sp.psh;
          mapped.cellTemp = sp.cellTemp;
          mapped.soilingLoss = sp.soilingLoss;
          mapped.minTemp = sp.minTemp;
          mapped.altitude = sp.altitude;
        }
      }
      // Estimate shading loss from survey shading sources
      const activeShadingOpts = survey.shadingSources.filter((s) => s !== "None");
      if (activeShadingOpts.length > 0) {
        mapped.shadingLoss = Math.min(0.05 * activeShadingOpts.length, 0.25);
      } else if (survey.shadingSources.includes("None")) {
        mapped.shadingLoss = 0.01;
      }
      // Idempotency guard: never return a NEW object when nothing actually
      // changed. Returning {...p} unconditionally would let any dependency
      // churn re-render/re-run downstream effects for no reason (defensive
      // against render loops of the class that caused the tab freeze).
      const same = mapped.client === p.client && mapped.location === p.location
        && mapped.monthlyBill === p.monthlyBill && mapped.siteType === p.siteType
        && mapped.phase === p.phase && mapped.siteProfile === p.siteProfile
        && mapped.psh === p.psh && mapped.cellTemp === p.cellTemp
        && mapped.soilingLoss === p.soilingLoss && mapped.minTemp === p.minTemp
        && mapped.altitude === p.altitude && mapped.shadingLoss === p.shadingLoss;
      return same ? p : mapped;
    });
  }, [survey.clientName, survey.siteAddress, survey.monthlyBill, survey.siteType, survey.phaseType, survey.county, survey.shadingSources]);

  // v11.4 — strictly whitelisted summary sent to the AI assistant (see
  // utils/assistantContext.js). Never includes saved projects or feedback.
  const assistantContext = useMemo(
    () => buildAssistantContext(project, derivedLoads, survey, sizing, readiness, panelLayout, project.energyImport),
    [project, derivedLoads, survey, sizing, readiness, panelLayout]
  );

  // v11.4 — if the current tab is hidden by the active view mode, fall back to
  // a tab that mode can show (prevents a blank screen after switching).
  useEffect(() => {
    if (viewMode === "engineer") return;
    const allowed = getWorkspaceNavigation({ viewMode, project }).flatMap((group) => group.items.map((item) => item.key));
    if (!allowed.includes(active)) setActive(viewMode === "bank" ? "bank-flow" : "field-dashboard");
  }, [viewMode, active, project.systemType]);
  useEffect(() => {
    if (enforceRoleAccess && !isTabAllowedForRole(active, actorRole)) setActive("field-dashboard");
  }, [active, actorRole, enforceRoleAccess]);

  // v11.5.2 — when a highlight target is set, scroll the tagged element into
  // view (the .vf-highlight class provides the glow; CSS respects reduced-motion).
  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-highlight="${highlightId}"]`);
      if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
    }, 120);
    return () => clearTimeout(t);
  }, [highlightId, active]);

  // ── v11.4.1 startup actions ────────────────────────────────────────────
  const lastProjectRecord = useMemo(
    () => cloudEnabled ? savedProjects[0] || null : safeMode ? null : findLastActiveProject(savedProjects),
    [cloudEnabled, safeMode, savedProjects]
  );

  const activateProject = (nextProject, nextLoads, nextSurvey, nextTab, record) => {
    setProject(nextProject);
    setLoadAssessmentMode(normalizeLoadAssessmentMode(
      nextProject?.loadAssessmentMode || inferLoadAssessmentMode(nextSurvey?.siteType || nextProject?.siteType, nextProject?.objectiveKey)
    ));
    if (Array.isArray(nextLoads)) {
      const v2 = migrateLegacyLoadsToV2(nextLoads);
      setLoadItemsV2(v2);
      setDraftLoadItemsV2(v2);
      setHasUnappliedLoadChanges(false);
    }
    if (nextSurvey) setSurvey((s) => ({ ...s, ...nextSurvey }));
    setHasActiveProject(true);
    setStartupView("welcome");
    setActive(nextTab || "dashboard");
    if (cloudEnabled) setCloudProjectRecord(record?.providerMode === "supabase" ? record : null);
    else if (record?.id) rememberLastActiveProject(record.id, record.name);
  };

  const handleCreateFromWizard = (answers) => {
    const { project: built, nextTab } = buildProjectFromOnboarding(defaultProject, answers);
    activateProject(built, createBlankLoads(), {
      clientName: built.client,
      siteAddress: built.location,
      siteType: built.siteType || "Residential",
      monthlyBill: built.monthlyBill,
      phaseType: built.phase,
    }, nextTab);
    recordAudit(AUDIT_EVENT_TYPES.PROJECT_CREATED, `${built.client || "New project"} (${built.systemType || "system TBD"})`, { user: built.preparedBy });
    if (cloudEnabled) setCloudProjectRecord(null);
    showToast(`Project created for ${built.client}. ${getLoadSource(answers.loadSourceKey)?.label || ""} — continue from here.`);
  };

  const handleLoadDemo = (demoId) => {
    const demo = createProjectFromDemo(defaultProject, demoId);
    if (!demo) return;
    activateProject(demo.project, demo.loads, demo.survey, "dashboard");
    if (cloudEnabled) setCloudProjectRecord(null);
    showToast(`${demo.project.demoLabel} loaded. This is demo data only.`);
  };

  const handleConvertDemo = (clientName) => {
    setProject((p) => convertDemoToRealProject(p, clientName));
    setPendingDemoConversion(false);
    showToast("Demo converted to a real project — update the site details before quoting.");
  };

  const handleContinueLast = () => {
    if (!lastProjectRecord) return;
    try {
      const norm = normalizeLoadedRecord(lastProjectRecord);
      setProject(norm.project);
      setSurvey(norm.survey);
      setSimulation(norm.simulation);
      setLoadAssessmentMode(norm.loadAssessmentMode);
      setLoadItemsV2AndDraft(norm.loadItemsV2);
      setAccessoriesAssumptions(norm.accessoriesAssumptions);
      setAccessoryOverrides(norm.accessoryOverrides);
      setAccessoriesCatalogue(norm.accessoriesCatalogue);
      setProjectRef(norm.projectRef);
      setHasActiveProject(true);
      setActive("dashboard");
      if (cloudEnabled) setCloudProjectRecord(lastProjectRecord);
      else rememberLastActiveProject(lastProjectRecord.id, lastProjectRecord.name);
      showToast(`Resumed: ${lastProjectRecord.name}`);
    } catch {
      quarantineLocalProjectRecord(lastProjectRecord, "Saved project could not be normalized during resume.");
      setSavedProjects((records) => records.filter((record) => record !== lastProjectRecord));
      setLocalProjectRecovery(getLocalProjectRecovery());
      showToast("Could not resume that project - it was skipped and preserved for recovery.", "error");
    }
  };

  // Commit draft → loadItemsV2 (called by "Update Sizing" button in LoadAssessment).
  // Invalid rows block the commit so sizing never runs on bad data (v11.1).
  const draftLoadErrors = useMemo(() => validateLoadItemsV2(draftLoadItemsV2), [draftLoadItemsV2]);
  const createCurrentDesignRevision = async (nextLoadItems = loadItemsV2) => {
    perf.current.designRevision += 1;
    const nextDerivedLoads = toLegacyLoads(nextLoadItems, loadAssessmentMode);
    const revision = await createDesignRevision({
      project,
      loads: nextDerivedLoads,
      loadItemsV2: nextLoadItems,
      roofFaces: activeFaces,
    });
    setProject((existing) => existing.designRevision?.inputs_hash === revision.inputs_hash
      ? existing
      : { ...existing, designRevision: revision, selectedDesignOption: null });
    return revision;
  };

  const commitDraftLoadItems = async () => {
    if (draftLoadErrors.length > 0) {
      showToast(`Cannot update sizing — ${draftLoadErrors.length} load row(s) are invalid. Fix the highlighted rows first.`, "error");
      return;
    }
    try {
      await createCurrentDesignRevision(draftLoadItemsV2);
      setLoadItemsV2(draftLoadItemsV2);
      setHasUnappliedLoadChanges(false);
      recordAudit(AUDIT_EVENT_TYPES.LOAD_APPLIED, `${draftLoadItemsV2.length} load item(s) applied`, { user: project.preparedBy });
      recordAudit(AUDIT_EVENT_TYPES.SIZING_CHANGED, "Recomputed after Update Sizing", { user: project.preparedBy });
      showToast("Sizing updated — all load changes applied and a design revision was created.");
    } catch {
      setProject(settleFailedDesignRevision);
      showToast("Could not create the design revision. Sizing was not updated.", "error");
    }
  };

  // Discard draft edits and restore the last committed loads (v11.1)
  const resetDraftLoadItems = () => {
    setDraftLoadItemsV2(loadItemsV2);
    setHasUnappliedLoadChanges(false);
    showToast("Draft changes discarded — load table restored to the applied loads.");
  };

  // When load items are replaced externally (save/load, import), sync draft too
  const setLoadItemsV2AndDraft = (newItems) => {
    const resolved = typeof newItems === "function" ? newItems(loadItemsV2) : newItems;
    setLoadItemsV2(resolved);
    setDraftLoadItemsV2(resolved);
    setHasUnappliedLoadChanges(false);
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!cloudEnabled || !activeMembership?.organisationId) return undefined;
    let activeRequest = true;
    platform.projects.listProjects({ organisationId: activeMembership.organisationId })
      .then((records) => { if (activeRequest) setSavedProjects(records); })
      .catch((error) => {
        if (activeRequest) setToast({ msg: `Could not load organisation projects: ${error?.message || "unknown error"}`, type: "error" });
      });
    return () => { activeRequest = false; };
  }, [platform, cloudEnabled, activeMembership?.organisationId]);

  const prepareProjectVersion = async (lifecycle = "prepared", reportType = "proposal") => {
    if (!cloudEnabled) return null;
    if (!cloudProjectRecord?.id) throw new Error("Save this project to the organisation workspace before preparing a proposal version.");
    const currentDesignRevision = await createCurrentDesignRevision(loadItemsV2);
    if (project.selectedDesignOption && project.selectedDesignOption.inputs_hash !== currentDesignRevision.inputs_hash) {
      throw new Error("STALE_DESIGN: the selected system option was calculated from an older project revision.");
    }
    const versionedProject = { ...project, designRevision: currentDesignRevision };
    const record = {
      schemaVersion: SCHEMA_VERSION,
      appVersion: APP_VERSION,
      projectRef,
      project: versionedProject,
      survey,
      simulation,
      loadAssessmentMode,
      loadItemsV2,
      accessoriesAssumptions,
      accessoryOverrides,
      accessoriesCatalogue,
      copilotHistory,
      copilotLastReview,
    };
    const envelope = await createProjectVersionEnvelope({
      record,
      sizing,
      lifecycle,
      billLoadReconciliation,
      preparedByUserId: platformContext.authorization?.userId,
      assumptions: {
        billSource: project.billSource || "client_estimate",
        loadSource: project.loadSource || "estimated",
        pricingSource: project.pricingSource || "default",
        surveyConfirmationRequired: true,
      },
      boq: {
        headline: { totalInvestment: sizing.totalCost },
        lines: accessoriesBoQ?.categories || {},
        internalTotals: accessoriesBoQ?.commercialSummary || {},
      },
      evidenceStatus: project.evidence || null,
      reportMetadata: { reportType, generatedAt: new Date().toISOString(), methodologyVersion: APP_VERSION },
    });
    return platform.projects.createVersion({
      organisationId: activeMembership.organisationId,
      projectId: cloudProjectRecord.id,
      lifecycle,
      envelope,
      reportMetadata: envelope.snapshot.reportMetadata,
      boqRevision: {
        lines: Object.values(accessoriesBoQ?.categories || {}).flatMap((rows) => Array.isArray(rows) ? rows : []),
        internalTotals: accessoriesBoQ?.commercialSummary || {},
        publicHeadline: { totalInvestment: sizing.totalCost },
      },
      requestId: crypto.randomUUID(),
      reason: lifecycle === "issued" ? "Proposal version issued" : "Proposal version prepared",
    });
  };

  // v11.5.2 — guided navigation. Remembers the origin view so a Back button can
  // return, optionally highlights a target field/card, and closes the Action
  // Center. Internal app state only — never touches browser history.
  const navigateToTab = (targetTab, options = {}) => {
    const { source, highlightId: hid, toast: toastMsg } = options;
    setPreviousView({ tab: active, source: source || "nav" });
    if (source === "action_center") setActionCenterOpen(false);
    setActive(targetTab);
    setSidebarOpen(false);
    if (hid) {
      setHighlightId(hid);
      setTimeout(() => setHighlightId((cur) => (cur === hid ? null : cur)), 4000);
    } else {
      setHighlightId(null);
    }
    if (toastMsg) showToast(toastMsg);
  };
  const goBack = () => {
    const target = resolveBackTarget(previousView);
    setPreviousView(null);
    setHighlightId(null);
    setActive(target);
  };

  // v11.7 — Voltflow Studio: apply a template (loads + project + borehole) or a
  // Good/Better/Best scenario. Deterministic; the user can edit everything after.
  const applyStudioTemplate = (id) => {
    const r = applyTemplate(project, id);
    if (!r) return;
    setProject((p) => ({ ...p, ...r.project }));
    setLoadItemsV2AndDraft(r.loadItemsV2);
    setLoadAssessmentMode(r.loadAssessmentMode);
    recordAudit(AUDIT_EVENT_TYPES.PROJECT_CREATED, `Template: ${getTemplate(id)?.name || id}`, { user: project.preparedBy });
    showToast(`Loaded template: ${getTemplate(id)?.name || id}. Review and Update Sizing.`);
    navigateToTab("loads", { source: "studio", highlightId: "load-table" });
  };
  const applyStudioScenario = (id) => {
    const sp = buildScenarioProject(project, id);
    setProject((p) => ({ ...p, solarCoverage: sp.solarCoverage ?? p.solarCoverage, backupHours: sp.backupHours ?? p.backupHours, autonomyDays: sp.autonomyDays ?? p.autonomyDays, selectedScenarioId: id }));
    recordAudit(AUDIT_EVENT_TYPES.SIZING_CHANGED, `Scenario: ${getScenario(id)?.name || id}`, { user: project.preparedBy });
    showToast(`Applied ${getScenario(id)?.name || id} design.`);
  };

  return (
    <div className={`app-container ${sidebarOpen ? "vfw-menu-open" : ""}`}>
      <a className="vfw-skip-link" href="#workspace-main">Skip to workspace</a>
      {/* Mobile Header */}
      <div className="nav-mobile-toggle">
        <BrandLogo style={{ height: "28px" }} />
        <button id="workspace-menu-toggle" aria-expanded={sidebarOpen} aria-controls="workspace-sidebar" onClick={() => setSidebarOpen(!sidebarOpen)} className="btn btn-secondary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}>
          {sidebarOpen ? "Close Menu" : "Open Menu"}
        </button>
      </div>

      <Sidebar active={active} setActive={(targetTab) => { if (targetTab !== active) navigateToTab(targetTab); }} project={project} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
        viewMode={viewMode} setViewMode={setViewMode} hasActiveProject={hasActiveProject}
        actorRole={actorRole} enforceRoleAccess={enforceRoleAccess}
        onExitToStart={() => { setHasPausedWorkspace(true); setHasActiveProject(false); setStartupView("welcome"); setSidebarOpen(false); }} />

      {/* key drives the page-transition animation; kept STABLE during startup so
          the onboarding wizard never remounts and loses its step state */}
      <main id="workspace-main" tabIndex={-1} inert={sidebarOpen ? "" : undefined} className="main-content" key={hasActiveProject ? active : "startup"}>
        <div className="content-max-width vf-page-enter">
          {hasActiveProject && <WorkspaceHeader project={project} active={active} previousTab={previousView?.tab}
            groups={getWorkspaceNavigation({ viewMode, project, canAccess: (key) => !enforceRoleAccess || isTabAllowedForRole(key, actorRole) })}
            onBack={goBack} onNavigate={(targetTab) => { if (targetTab !== active) navigateToTab(targetTab); }} />}
          {/* v11.7.1 — classification / pilot banner (always visible) */}
          <details className={`vf-pilot-banner ${viewMode === "bank" ? "bank" : ""}`}>
            <summary><strong>Planning estimates.</strong> Final designs require qualified engineering review.</summary>
            <div className="vf-pilot-banner-details">
              Voltflow <strong>Internal Alpha / Controlled EPC Staging Build</strong> — feasibility & workflow only, not certified engineering approval. {cloudEnabled ? `Authenticated tenant workspace: ${activeMembership?.organisationName || "organisation"} (${actorRole}).` : "Browser-only storage; use test or non-sensitive customer data until auth and tenant isolation are enabled. No cloud submission occurs."}
            </div>
          </details>
          {safeMode && (
            <div className="vf-safe-mode-banner" role="status">
              <div><strong>Safe Mode</strong> - saved browser project data not loaded.</div>
              <ResetLocalDataPanel showToast={showToast} compact onCleared={() => { setSavedProjects([]); setLocalProjectRecovery(null); }} />
            </div>
          )}
          {!safeMode && localProjectRecovery && (
            <WarningPanel tone="warning" title="Saved browser project data was skipped">
              {localProjectRecovery.reason} The original browser value was not deleted. Recovery metadata was saved under a separate backup key. Use the reset control only after exporting anything you need.
            </WarningPanel>
          )}
          {/* v11.4.1 — DEMO badge banner, visible in every tab incl. client view */}
          {hasActiveProject && project.isDemo && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem", marginBottom: "1rem",
              background: "#f5f3ff", border: "1.5px solid #c4b5fd", borderRadius: "var(--radius-md)", padding: "0.7rem 1rem" }}>
              <StatusPill tone="premium">🧪 DEMO PROJECT</StatusPill>
              <span style={{ fontSize: "0.8rem", color: "#5b21b6", flex: 1, minWidth: "220px", lineHeight: 1.5 }}>
                {project.demoLabel ? `${project.demoLabel} — ` : ""}{DEMO_DISCLAIMER}
              </span>
              {!pendingDemoConversion && (
                <button onClick={() => setPendingDemoConversion(true)} className="btn btn-secondary" style={{ fontSize: "0.78rem" }}>
                  Use as template for a real project
                </button>
              )}
            </div>
          )}
          {hasActiveProject && project.isDemo && pendingDemoConversion && (
            <Card title="Convert demo into a real project" subtitle="Enter the real client name. The demo badge is removed and the numbers stay as a starting point — review every input before quoting.">
              <FormGrid min={220}>
                <div className="field-group">
                  <span className="field-label">Real client / company name *</span>
                  <input className="field-input" autoFocus id="vf-demo-convert-name" placeholder="e.g. Acme Ltd" />
                </div>
              </FormGrid>
              <ActionBar>
                <button className="btn btn-primary" onClick={() => {
                  const el = document.getElementById("vf-demo-convert-name");
                  const name = el && el.value.trim();
                  if (!name) { showToast("Enter the real client name first.", "error"); return; }
                  handleConvertDemo(name);
                }}>✓ Convert to real project</button>
                <button className="btn btn-secondary" onClick={() => setPendingDemoConversion(false)}>Cancel</button>
              </ActionBar>
            </Card>
          )}

          {/* v11.4.1 — clean startup gate: nothing loads until the user chooses */}
          {!hasActiveProject && startupView === "welcome" && (
            <StartScreen
              cloudEnabled={cloudEnabled}
              pausedProject={hasPausedWorkspace ? project : null}
              onResumeCurrent={() => setHasActiveProject(true)}
              savedCount={savedProjects.length}
              lastProject={lastProjectRecord}
              onNewProject={() => setStartupView("wizard")}
              onDemo={() => setStartupView("demos")}
              onOpenSaved={() => { setHasActiveProject(true); setActive("storage"); }}
              onImport={() => { setHasActiveProject(true); setActive("storage"); }}
              onEnergyUpload={() => {
                setProject((p) => createBlankProject(p, { client: "", loadSource: "data_logger" }));
                setHasActiveProject(true);
                setActive("energy-import");
                showToast("Upload your energy data — you can name the project afterwards in Project Setup.");
              }}
              onContinueLast={handleContinueLast}
              showToast={showToast}
              onLocalDataCleared={() => { setSavedProjects([]); setLocalProjectRecovery(null); }}
            />
          )}
          {!hasActiveProject && startupView === "wizard" && (
            <OnboardingWizard
              siteProfileNames={Object.keys(siteProfiles)}
              onCreate={handleCreateFromWizard}
              onCancel={() => setStartupView("welcome")}
            />
          )}
          {!hasActiveProject && startupView === "demos" && (
            <DemoPicker onLoadDemo={handleLoadDemo} onBack={() => setStartupView("welcome")} />
          )}

          {hasActiveProject && <>
          {/* Field workflow tabs */}
          {active === "field-dashboard" && (viewMode === "client"
            ? <ClientDashboard project={project} sizing={sizing} setActive={setActive} advisory={advisory} simulation={simulation} />
            : <ReadinessDashboard project={project} sizing={sizing} readiness={projectReadiness} viewMode={viewMode} navigateToTab={navigateToTab} onOpenActionCenter={() => setActionCenterOpen(true)} highlightId={highlightId} />)}
          {active === "new-project"    && <NewProject survey={survey} setSurvey={setSurvey} setActive={setActive} />}
          {active === "site-survey"    && <SiteSurvey survey={survey} setSurvey={setSurvey} setActive={setActive} />}
          {active === "roof-shading"   && <RoofShading survey={survey} setSurvey={setSurvey} setActive={setActive} />}
          {active === "electrical"     && <ElectricalAssessment survey={survey} setSurvey={setSurvey} setActive={setActive} />}
          {active === "site-photos"    && <SitePhotos survey={survey} setSurvey={setSurvey} />}
          {active === "safety-risks"   && <SafetyRisks survey={survey} setSurvey={setSurvey} />}
          {/* Engineering tabs */}
          {active === "dashboard"  && (viewMode === "client"
            ? <ClientDashboard project={project} sizing={sizing} setActive={setActive} advisory={advisory} simulation={simulation} />
            : <Dashboard project={project} sizing={sizing} setActive={setActive} readiness={readiness} advisory={advisory} governance={governance} panelLayout={panelLayout} roofWarnings={roofWarnings} simWarnings={simWarnings} hasUnappliedLoadChanges={hasUnappliedLoadChanges} />)}
          {active === "project"    && <ProjectInputs project={project} setProject={setProject} setActive={setActive} />}
          {active === "loads"      && <LoadAssessment
            loadAssessmentMode={loadAssessmentMode}
            setLoadAssessmentMode={setLoadAssessmentMode}
            loadItemsV2={loadItemsV2}
            draftLoadItemsV2={draftLoadItemsV2}
            setDraftLoadItemsV2={setDraftLoadItemsV2}
            hasUnappliedLoadChanges={hasUnappliedLoadChanges}
            setHasUnappliedLoadChanges={setHasUnappliedLoadChanges}
            onCommit={commitDraftLoadItems}
            onReset={resetDraftLoadItems}
            draftLoadErrors={draftLoadErrors}
            sizingMode={project.sizingMode}
            setSizingMode={(v) => setProject((p) => ({ ...p, sizingMode: v }))}
            blueprint={project.blueprint}
            setBlueprint={(patch) => setProject((p) => ({ ...p, blueprint: { ...(p.blueprint || {}), ...patch } }))}
            sizing={sizing}
            loadSummary={loadSummary}
            loadWarnings={loadWarnings}
            dataLoggerRecommendation={dataLoggerRecommendation}
            loadProfile24h={loadProfile24h}
            showToast={showToast}
            highlightId={highlightId}
          />}
          {active === "energy-import" && <EnergyDataImport
            project={project}
            setProject={setProject}
            draftLoadItemsV2={draftLoadItemsV2}
            setDraftLoadItemsV2={setDraftLoadItemsV2}
            setHasUnappliedLoadChanges={setHasUnappliedLoadChanges}
            showToast={showToast}
            setActive={setActive}
          />}
          {active === "generation" && <Generation project={project} setProject={setProject} sizing={sizing} />}
          {active === "battery"    && <Battery project={project} setProject={setProject} sizing={sizing} batteryHardware={batteryHardware} night={projectReadiness.night} highlightId={highlightId} />}
          {active === "inverter"   && <Inverter project={project} setProject={setProject} sizing={sizing} highlightId={highlightId} navigateToTab={navigateToTab} />}
          {active === "eng-compliance" && <EngineeringCompliance project={project} sizing={sizing} survey={survey} />}
          {active === "system-options" && <SystemOptionsTab options={systemOptions} project={project} setProject={setProject} sizing={sizing} advisory={advisory} roofGeometry={roofGeometry} multiRoofDist={multiRoofDist} activeFaces={activeFaces} />}
          {active === "readiness"  && <ProjectReadinessTab readiness={readiness} advisory={advisory} confidence={confidence} governance={governance} quickWins={quickWins} project={project} sizing={sizing} setProject={setProject} showToast={showToast} />}
          {active === "finance"    && <Finance project={project} setProject={setProject} sizing={sizing} />}
          {active === "carbon"     && <Carbon project={project} setProject={setProject} sizing={sizing} />}
          {active === "installer-sim" && <InstallerSimulation project={project} setProject={setProject} survey={survey} sizing={sizing} simulation={simulation} setSimulation={setSimulation} roofGeometry={roofGeometry} panelLayout={panelLayout} simWarnings={simWarnings} multiRoofDist={multiRoofDist} activeFaces={activeFaces} liveStringPlan={liveStringPlan} asBuiltIssues={asBuiltIssues} showToast={showToast} />}
          {active === "accessories" && <AccessoriesTab accessoriesBoQ={accessoriesBoQ} accessoryOverrides={accessoryOverrides} setAccessoryOverrides={setAccessoryOverrides} accessoriesAssumptions={accessoriesAssumptions} setAccessoriesAssumptions={setAccessoriesAssumptions} />}
          {active === "boq"        && <BOQ project={project} sizing={sizing} accessoriesBoQ={accessoriesBoQ} borehole={boreholeResult} setActive={setActive} />}
          {active === "proposal"   && <Proposal project={project} setProject={setProject} sizing={sizing} loadItemsV2={loadItemsV2} showToast={showToast} survey={survey} readiness={readiness} projectReadiness={projectReadiness} navigateToTab={navigateToTab} advisory={advisory} panelLayout={panelLayout} tiltGuidance={tiltGuidance} roofGeometry={roofGeometry} simulation={simulation} simWarnings={simWarnings} stringPlan={liveStringPlan} loadSummary={loadSummary} loadWarnings={loadWarnings} dataLoggerRecommendation={dataLoggerRecommendation} accessoriesBoQ={accessoriesBoQ} borehole={boreholeResult} viewMode={viewMode} billLoadReconciliation={billLoadReconciliation} onPrepareVersion={prepareProjectVersion} cloudEnabled={cloudEnabled} platform={platform} activeMembership={activeMembership} actorRole={actorRole} cloudProjectId={cloudProjectRecord?.id} />}
          {active === "roof-layout" && <RoofLayoutTab survey={survey} setSurvey={setSurvey} project={project} setProject={setProject} sizing={sizing} roofGeometry={roofGeometry} panelLayout={panelLayout} tiltGuidance={tiltGuidance} rowSpacing={rowSpacing} installerTips={installerTips} roofWarnings={roofWarnings} blueprintAdvice={blueprintAdvice} />}
          {active === "storage"    && <Storage project={project} setProject={setProject}
            loadAssessmentMode={loadAssessmentMode} setLoadAssessmentMode={setLoadAssessmentMode}
            loadItemsV2={loadItemsV2} setLoadItemsV2={setLoadItemsV2AndDraft}
            accessoriesAssumptions={accessoriesAssumptions} setAccessoriesAssumptions={setAccessoriesAssumptions}
            accessoryOverrides={accessoryOverrides} setAccessoryOverrides={setAccessoryOverrides}
            accessoriesCatalogue={accessoriesCatalogue} setAccessoriesCatalogue={setAccessoriesCatalogue}
            projectRef={projectRef} setProjectRef={setProjectRef}
            copilotHistory={copilotHistory} setCopilotHistory={setCopilotHistory}
            copilotLastReview={copilotLastReview} setCopilotLastReview={setCopilotLastReview}
            survey={survey} setSurvey={setSurvey} simulation={simulation} setSimulation={setSimulation}
            savedProjects={savedProjects} setSavedProjects={setSavedProjects} showToast={showToast}
            viewMode={viewMode}
            platform={platform} activeMembership={activeMembership} cloudEnabled={cloudEnabled}
            cloudProjectId={cloudProjectRecord?.id} cloudRevisionNo={cloudProjectRecord?.revisionNo}
            onCloudProjectChanged={setCloudProjectRecord}
            onLocalProjectQuarantined={() => setLocalProjectRecovery(getLocalProjectRecovery())}
            onProjectActivated={(record) => { setHasActiveProject(true); if (cloudEnabled) setCloudProjectRecord(record); else if (record?.id) rememberLastActiveProject(record.id, record.name); }} />}
          {active === "borehole"   && <SolarBorehole project={project} setProject={setProject} borehole={boreholeResult} navigateToTab={navigateToTab} showToast={showToast} />}
          {active === "compliance" && <ComplianceWorkspace project={project} setProject={setProject} />}
          {active === "evidence"   && <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {cloudEnabled
              ? cloudProjectRecord?.id
                ? <CloudEvidenceAuditWorkspace platform={platform} organisationId={activeMembership.organisationId} projectId={cloudProjectRecord.id} actorRole={actorRole} roofFaces={activeFaces} showToast={showToast} />
                : <WarningPanel tone="warning" title="Save project before adding cloud evidence">Create the tenant-owned cloud project from Save / Load first.</WarningPanel>
              : <>
                  <CloudEvidenceAuditWorkspace platform={platform} organisationId={activeMembership?.organisationId} projectId={String(projectRef)} actorRole={actorRole} roofFaces={activeFaces} showToast={showToast} />
                  <EvidenceWorkspace project={project} setProject={setProject} showToast={showToast} />
                </>}
            <PilotOperationsPanel project={project} setProject={setProject} cloudEnabled={cloudEnabled} />
          </div>}
          {active === "studio"     && <VoltflowStudio project={project} sizing={sizing} readiness={projectReadiness} blocks={studioBlocks} derivedLoads={derivedLoads} navigateToTab={navigateToTab} openExplain={setExplainKey} onApplyTemplate={applyStudioTemplate} onApplyScenario={applyStudioScenario} viewMode={viewMode} />}
          {active === "bank-flow"  && <BankPilotFlow project={project} setProject={setProject} sizing={sizing} derivedLoads={derivedLoads} readiness={projectReadiness} navigateToTab={navigateToTab} onApplyScenario={applyStudioScenario} showToast={showToast} />}
          {active === "assets-lib" && <AssetLibraryTab project={project} setProject={setProject} sizing={sizing} showToast={showToast} />}
          {active === "genset"     && <GensetHybrid project={project} setProject={setProject} sizing={sizing} />}
          {active === "ev"         && <EVCharging project={project} setProject={setProject} sizing={sizing} />}
          {active === "minigrid"   && <MiniGrid project={project} setProject={setProject} sizing={sizing} />}
          {active === "feedback"   && <FeedbackPanel showToast={showToast}
            buildSnapshot={() => ({ schemaVersion: SCHEMA_VERSION, appVersion: APP_VERSION, snapshotAt: new Date().toISOString(), project, survey, simulation, loadAssessmentMode, loadItemsV2 })} />}
          {active === "assistant"  && <AssistantPanel showToast={showToast} assistantContext={assistantContext}
            readiness={projectReadiness} navigateToTab={navigateToTab} previousView={previousView} onBack={goBack} viewMode={viewMode} />}
          {active === "delivery"   && <ProjectDelivery project={project} setProject={setProject} sizing={sizing}
            accessoriesBoQ={accessoriesBoQ} viewMode={viewMode} showToast={showToast} />}
          </>}
        </div>
      </main>
      {/* v11.5.2 — Project Action Center (engineer + technician only) */}
      {hasActiveProject && viewMode !== "client" && (
        <FloatingActionCenter
          readiness={projectReadiness}
          open={actionCenterOpen}
          onOpen={() => setActionCenterOpen(true)}
          onClose={() => setActionCenterOpen(false)}
          navigateToTab={navigateToTab}
          viewMode={viewMode}
          hasUnappliedLoadChanges={hasUnappliedLoadChanges}
        />
      )}

      {/* v11.7 — Explain-this drawer (opened from Studio + metric buttons) */}
      <ExplainDrawer open={!!explainKey} explanation={explainKey ? explain(explainKey, explainCtx) : null} onClose={() => setExplainKey(null)} />

      {/* v11.6 — clean Help/Feedback dock (bottom-right, stacked, never overlaps
          inputs; labels collapse to icons on small screens). Action Center FAB
          lives bottom-left, so they don't collide. */}
      {hasActiveProject && <div className="vf-help-dock">
        {active !== "assistant" && viewMode !== "bank" && (
          <button onClick={() => setActive("assistant")} title="Ask the Voltflow AI Assistant" className="vf-help-btn vf-help-primary">
            ✨ <span className="vf-help-label">AI Assistant</span>
          </button>
        )}
        {active !== "feedback" && viewMode !== "client" && (
          <button onClick={() => setActive("feedback")} title="Send Feedback / Report Issue" className="vf-help-btn vf-help-dark">
            🐞 <span className="vf-help-label">Feedback</span>
          </button>
        )}
      </div>}
      <Toast toast={toast} />
    </div>
  );
}
