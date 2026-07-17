export const SIMPLIFIED_WORKFLOW = true;

export const STATUS_COLORS = {
  DRAFT: 'draft',
  PENDING_INSPECTION: 'pending',
  PENDING_ACCOUNTS_REVIEW: 'pending',
  PENDING_SM_REVIEW: 'review',
  PENDING_GM_APPROVAL: 'approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  COMPONENTS_ISSUED: 'approved',
  REWORK_IN_PROGRESS: 'review',
  NEW_PRODUCTION: 'approval',
  CLOSED: 'closed'
};

export const STATUS_LABELS = {
  DRAFT: 'Draft',
  PENDING_INSPECTION: 'Pending Inspection',
  PENDING_ACCOUNTS_REVIEW: 'Pending Accounts Verification',
  PENDING_SM_REVIEW: 'SM Review',
  PENDING_GM_APPROVAL: 'GM Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  COMPONENTS_ISSUED: 'Components Issued',
  REWORK_IN_PROGRESS: 'Rework In Progress',
  NEW_PRODUCTION: 'New Production',
  CLOSED: 'Closed'
};

export const ROLES = [
  'OPERATOR',
  'INSPECTOR',
  'SENIOR_MANAGER',
  'GENERAL_MANAGER',
  'STORE_MANAGER',
  'ADMIN',
  'ACCOUNTS'
];

export function getActiveStages(template, failedStage) {
  const stages = PROCESS_TEMPLATES[template] || [];
  const idx = stages.indexOf(failedStage);
  return idx !== -1 ? stages.slice(0, idx + 1) : [];
}

export function sumStageCosts(activeStages, costs) {
  let parsed = costs;
  if (typeof costs === 'string') {
    try {
      parsed = JSON.parse(costs);
    } catch {
      parsed = {};
    }
  }
  return Math.round(activeStages.reduce((sum, st) => sum + (Number(parsed?.[st]) || 0), 0));
}

export const PROCESS_TEMPLATES = {
  'APG_ less than 6 dia': ['DESIGN_APG', 'RM_APG', 'OP140_CG', 'SUPER_DRILL', 'OP150_SG_JET_RECESS', 'OP170_VA'],
  'APG_Vertical Bench mount _ Super Drill': ['DESIGN_APG', 'RM_APG', 'OP10_TURNING', 'OP80_HT', 'OP90_SZ', 'OP100_BLK', 'OP20_JC', 'SUPER_DRILL', 'OP140_CG', 'OP150_SG_JET_RECESS', 'OP170_VA', 'OP200_MARKING'],
  'APG_Vertical Bench mount _ Jet press': ['DESIGN_APG', 'RM_APG', 'OP10_TURNING', 'OP20_JC', 'OP40_50_CH', 'OP60_QC', 'OP80_HT', 'OP90_SZ', 'OP100_BLK', 'OP140_CG', 'OP150_SG_JET_RECESS', 'OP170_VA', 'OP200_MARKING'],
  'SRG_less than 6 dia': ['DESIGN_SRG', 'RM_SRG', 'OP10_TURNING_SRG', 'OP80_HT_SRG', 'OP90_SZ_SRG', 'OP100_BLK_SRG', 'OP_SG_SS', 'OP_WC', 'OP_SG_BS', 'OP_CA_SRG'],
  'SRG_honing finish': ['DESIGN_SRG', 'RM_SRG', 'OP10_TURNING_SRG', 'OP80_HT_SRG', 'OP90_SZ_SRG', 'OP100_BLK_SRG', 'OP_SG_SS', 'OP140_CG_SRG', 'OP_HO_SRG', 'OP_SG_BS', 'OP_CA_SRG'],
  'SRG_above 60 direct finish': ['DESIGN_SRG', 'RM_SRG', 'OP10_TURNING_SRG', 'OP80_HT_SRG', 'OP90_SZ_SRG', 'OP100_BLK_K_SRG', 'OP_SG_SS', 'OP140_CG_SRG', 'OP_SG_BS', 'OP_CA_SRG'],
  'SRG_less than 6 dia (DC)': ['DESIGN_SRG', 'RM_SRG', 'OP10_TURNING_SRG', 'OP80_HT_SRG', 'OP90_SZ_SRG', 'OP_SG_BS', 'OP_DCPL', 'OP_WC', 'OP_CA_SRG'],
  'SRG_honing finish(DC)': ['DESIGN_SRG', 'RM_SRG', 'OP10_TURNING_SRG', 'OP80_HT_SRG', 'OP90_SZ_SRG', 'OP_SG_BS', 'OP140_CG_SRG', 'OP_DCPL', 'OP_HO_SRG', 'OP_CA_SRG'],
  'SRG_above 60 direct finish(DC)': ['DESIGN_SRG', 'RM_SRG', 'OP10_TURNING_SRG', 'OP80_HT_SRG', 'OP90_SZ_SRG', 'OP_SG_BS', 'OP_DCPL', 'OP140_CG_SRG', 'OP_CA_SRG'],
  'SRG_20-60 direct finish': ['DESIGN_SRG', 'RM_SRG', 'OP10_TURNING_SRG', 'OP80_HT_SRG', 'OP90_SZ_SRG', 'OP100_BLK_K_SRG', 'OP_SG_SS', 'OP140_CG_SRG', 'OP_SG_BS', 'OP_CA_SRG'],
  'SRG_20-60 direct finish (DC)': ['DESIGN_SRG', 'RM_SRG', 'OP10_TURNING_SRG', 'OP80_HT_SRG', 'OP90_SZ', 'OP_SG_BS', 'OP_DCPL', 'OP140_CG_SRG', 'OP_CA_SRG'],
  'APG_DIA 6-10': ['DESIGN_APG', 'RM_APG', 'OP10_TURNING', 'OP20_JC', 'OP40_50_CH', 'OP60_QC', 'OP80_HT', 'OP90_SZ', 'OP100_BLK', 'OP140_CG', 'OP150_SG_JET_RECESS', 'OP170_VA', 'OP200_MARKING'],
  'APG _Jet Press': ['DESIGN_APG', 'RM_APG', 'OP10_TURNING', 'OP20_JC', 'OP40_50_CH', 'OP60_QC', 'OP80_HT', 'OP90_SZ', 'OP100_BLK', 'OP130_JP', 'OP140_CG', 'OP150_SG_JET_RECESS', 'OP170_VA', 'OP200_MARKING'],
  'APG _SD': ['DESIGN_APG', 'RM_APG', 'OP10_TURNING', 'OP80_HT', 'OP90_SZ', 'OP100_BLK', 'OP20_JC', 'SUPER_DRILL', 'OP140_CG', 'OP150_SG_JET_RECESS', 'OP170_VA', 'OP200_MARKING'],
  'APG_Vertical Bench mount_Carbide': ['DESIGN_APG_CARBIDE', 'RM_APG_CARBIDE', 'TURNING_APG_CARBIDE', 'HT_APG_CARBIDE', 'SZ_APG_CARBIDE', 'CG_01_APG_CARBIDE', 'BRAZZING_APG_CARBIDE', 'CG_02_APG_CARBIDE', 'SD_APG_CARBIDE', 'QC_APG_CARBIDE', 'JET_RECESS_APG_CARBIDE', 'VA_APG_CARBIDE', 'MARKING_APG_CARBIDE'],
  'APG_Carbide': ['DESIGN_APG_CARBIDE', 'RM_APG_CARBIDE', 'TURNING_APG_CARBIDE', 'HT_APG_CARBIDE', 'SZ_APG_CARBIDE', 'CG_01_APG_CARBIDE', 'BRAZZING_APG_CARBIDE', 'CG_02_APG_CARBIDE', 'SD_APG_CARBIDE', 'QC_APG_CARBIDE', 'JET_RECESS_APG_CARBIDE', 'VA_APG_CARBIDE', 'MARKING_APG_CARBIDE'],
  'ARG_jet press': ['DESIGN_ARG', 'RM_ARG', 'OP10_TURNING_ARG', 'M1_ARG', 'BORING_ARG', 'CH_ARG', 'QC_ARG', 'HT_ARG', 'SZ_ARG', 'JP_ARG', 'SG_TOP_ARG', 'CG_ARG', 'HO_ARG', 'JET_RECESS_ARG', 'VA_ARG', 'JC_ARG', 'TOP_BOTTOM_SG', 'MARKING_ARG'],
  'ARG_above 60_jet press': ['DESIGN_ARG', 'RM_ARG', 'OP10_TURNING_ARG', 'M1_ARG', 'BORING_ARG', 'CH_ARG', 'QC_ARG', 'HT_ARG', 'SZ_ARG', 'JP_ARG', 'SG_TOP_ARG', 'CG_ARG', 'JET_RECESS_ARG', 'VA_ARG', 'JC_ARG', 'TOP_BOTTOM_SG', 'MARKING_ARG'],
  'ARG_super drill': ['DESIGN_ARG', 'RM_ARG', 'OP10_TURNING_ARG', 'M1_ARG', 'BORING_ARG', 'HT_ARG', 'SZ_ARG', 'SD_ARG', 'QC_ARG', 'SG_TOP_ARG', 'CG_ARG', 'HO_ARG', 'JET_RECESS_ARG', 'VA_ARG', 'JC_ARG', 'TOP_BOTTOM_SG', 'MARKING_ARG'],
  'ARG_above 60_Super drill': ['DESIGN_ARG', 'RM_ARG', 'OP10_TURNING_ARG', 'M1_ARG', 'BORING_ARG', 'HT_ARG', 'SZ_ARG', 'SD_ARG', 'QC_ARG', 'SG_TOP_ARG', 'CG_ARG', 'JET_RECESS_ARG', 'VA_ARG', 'JC_ARG', 'TOP_BOTTOM_SG', 'MARKING_ARG'],
  'ARG_Carbide': ['DESIGN_ARG_CARBIDE', 'RM_ARG_CARBIDE', 'TURNING_ARG_CARBIDE', 'M1TR_ARG_CARBIDE', 'HT_ARG_CARBIDE', 'SUBZERO_ARG_CARBIDE', 'SG_ARG_CARBIDE', 'CG_ARG_CARBIDE', 'SHRINK_FIT_ARG_CARBIDE', 'SG_ARG_CARBIDE_2', 'CG_ID_OD_ARG_CARBIDE', 'SD_ARG_CARBIDE', 'HO_ARG_CARBIDE', 'A/E_SLOT_ARG_CARBIDE', 'CG_JET_RECESS_ARG_CARBIDE'],
  'SPG': ['DESIGN_SPG', 'RM_SPG', 'TURNING_SPG', 'HT_SPG', 'SZ_SPG', 'TAPER_SHANK_GRINDING_SPG', 'BLK_SPG', 'CG_SPG', 'CA_SPG', 'VA_SPG', 'MARKING_SPG']
};
