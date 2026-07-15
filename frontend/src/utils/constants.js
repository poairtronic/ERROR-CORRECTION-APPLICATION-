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
  return activeStages.reduce((sum, st) => sum + (Number(costs[st]) || 0), 0);
}

export const PROCESS_TEMPLATES = {
  'APG LESS THAN 6': ['DESIGN_APG', 'RM_APG', 'OP140_CG', 'SUPER_DRILL', 'OP150_SG_JET_RECESS', 'OP170_VA'],
  'APG SD': ['DESIGN_APG', 'RM_APG', 'OP10_TURNING', 'OP80_HT', 'OP90_SZ', 'OP100_BLK', 'OP20_JC', 'SUPER_DRILL', 'OP140_CG', 'OP150_SG_JET_RECESS', 'OP170_VA', 'OP200_MARKING'],
  'APG JP': ['DESIGN_APG', 'RM_APG', 'OP10_TURNING', 'OP20_JC', 'OP40_50_CH', 'OP60_QC', 'OP80_HT', 'OP90_SZ', 'OP100_BLK', 'OP140_CG', 'OP150_SG_JET_RECESS', 'OP170_VA', 'OP200_MARKING'],
  'SRG LESS THAN 6': ['DESIGN_SRG', 'RM_SRG', 'OP10_TURNING_SRG', 'OP80_HT_SRG', 'OP90_SZ_SRG', 'OP100_BLK_SRG', 'OP_SG_SS', 'OP_WC', 'OP_SG_BS', 'OP_CA_SRG'],
  'SRG_6_TO_60': ['DESIGN_SRG', 'RM_SRG', 'OP10_TURNING_SRG', 'OP80_HT_SRG', 'OP90_SZ_SRG', 'OP100_BLK_SRG', 'OP_SG_SS', 'OP140_CG_SRG', 'OP_HO_SRG', 'OP_SG_BS', 'OP_CA_SRG'],
  'SRG_ABOVE_60': ['DESIGN_SRG', 'RM_SRG', 'OP10_TURNING_SRG', 'OP80_HT_SRG', 'OP90_SZ_SRG', 'OP100_BLK_K_SRG', 'OP_SG_SS', 'OP140_CG_SRG', 'OP_SG_BS', 'OP_CA_SRG'],
  'SRG_LESS_THAN_6_DULL_CHROME': ['DESIGN_SRG', 'RM_SRG', 'OP10_TURNING_SRG', 'OP80_HT_SRG', 'OP90_SZ_SRG', 'OP_SG_BS', 'OP_DCPL', 'OP_WC', 'OP_CA_SRG'],
  'SRG_6_TO_60_DULL_CHROME': ['DESIGN_SRG', 'RM_SRG', 'OP10_TURNING_SRG', 'OP80_HT_SRG', 'OP90_SZ_SRG', 'OP_SG_BS', 'OP140_CG_SRG', 'OP_DCPL', 'OP_HO_SRG', 'OP_CA_SRG'],
  'SRG_ABOVE_60_DULL_CHROME': ['DESIGN_SRG', 'RM_SRG', 'OP10_TURNING_SRG', 'OP80_HT_SRG', 'OP90_SZ_SRG', 'OP_SG_BS', 'OP_DCPL', 'OP140_CG_SRG', 'OP_CA_SRG'],
  'SRG 20 TO 60 DIRECT FINISH': ['DESIGN_SRG', 'RM_SRG', 'OP10_TURNING_SRG', 'OP80_HT_SRG', 'OP90_SZ_SRG', 'OP100_BLK_K_SRG', 'OP_SG_SS', 'OP140_CG_SRG', 'OP_SG_BS', 'OP_CA_SRG'],
  'SRG 20 TO 60 DIRECT FINISH DC': ['DESIGN_SRG', 'RM_SRG', 'OP10_TURNING_SRG', 'OP80_HT_SRG', 'OP90_SZ', 'OP_SG_BS', 'OP_DCPL', 'OP140_CG_SRG', 'OP_CA_SRG']
};
