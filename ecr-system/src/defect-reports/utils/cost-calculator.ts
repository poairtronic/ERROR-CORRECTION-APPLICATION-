import { DefectReport } from '../defect-report.entity';

/**
 * Maps failure templates (process route types) to their sequential manufacturing stages.
 * Each array represents a process path that is executed in order.
 */
export const PROCESS_TEMPLATES: Record<string, string[]> = {
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
  'SRG 20 TO 60 DIRECT FINISH DC': ['DESIGN_SRG', 'RM_SRG', 'OP10_TURNING_SRG', 'OP80_HT_SRG', 'OP90_SZ', 'OP_SG_BS', 'OP_DCPL', 'OP140_CG_SRG', 'OP_CA_SRG'],
  'APG DIA 6 TO 10 INHOUSE': ['DESIGN_APG', 'RM_APG', 'OP10_TURNING', 'OP20_JC', 'OP40_50_CH', 'OP60_QC', 'OP80_HT', 'OP90_SZ', 'OP100_BLK', 'OP140_CG', 'OP150_SG_JET_RECESS', 'OP170_VA', 'OP200_MARKING'],
  'APG_ABOVE 60 JP': ['DESIGN_APG', 'RM_APG', 'OP10_TURNING', 'OP20_JC', 'OP40_50_CH', 'OP60_QC', 'OP80_HT', 'OP90_SZ', 'OP100_BLK', 'OP130_JP', 'OP140_CG', 'OP150_SG_JET_RECESS', 'OP170_VA', 'OP200_MARKING'],
  'APG ABOVE 60 SD': ['DESIGN_APG', 'RM_APG', 'OP10_TURNING', 'OP80_HT', 'OP90_SZ', 'OP100_BLK', 'OP20_JC', 'SUPER_DRILL', 'OP140_CG', 'OP150_SG_JET_RECESS', 'OP170_VA', 'OP200_MARKING'],
  'APG_VBM_SD_CARBIDE': ['DESIGN_APG_CARBIDE', 'RM_APG_CARBIDE', 'TURNING_APG_CARBIDE', 'HT_APG_CARBIDE', 'SZ_APG_CARBIDE', 'CG_01_APG_CARBIDE', 'BRAZZING_APG_CARBIDE', 'CG_02_APG_CARBIDE', 'SD_APG_CARBIDE', 'QC_APG_CARBIDE', 'JET_RECESS_APG_CARBIDE', 'VA_APG_CARBIDE', 'MARKING_APG_CARBIDE'],
  'APG_15 TO 20_SD_CARBIDE': ['DESIGN_APG_CARBIDE', 'RM_APG_CARBIDE', 'TURNING_APG_CARBIDE', 'HT_APG_CARBIDE', 'SZ_APG_CARBIDE', 'CG_01_APG_CARBIDE', 'BRAZZING_APG_CARBIDE', 'CG_02_APG_CARBIDE', 'SD_APG_CARBIDE', 'QC_APG_CARBIDE', 'JET_RECESS_APG_CARBIDE', 'VA_APG_CARBIDE', 'MARKING_APG_CARBIDE'],
  'ARG_DIA_15 TO 25_JP': ['DESIGN_ARG', 'RM_ARG', 'OP10_TURNING_ARG', 'M1_ARG', 'BORING_ARG', 'CH_ARG', 'QC_ARG', 'HT_ARG', 'SZ_ARG', 'JP_ARG', 'SG_TOP_ARG', 'CG_ARG', 'HO_ARG', 'JET_RECESS_ARG', 'VA_ARG', 'JC_ARG', 'TOP_BOTTOM_SG', 'MARKING_ARG'],
  'ARG_DIA_ABOVE_60_JP_DIRECT FINISH': ['DESIGN_ARG', 'RM_ARG', 'OP10_TURNING_ARG', 'M1_ARG', 'BORING_ARG', 'CH_ARG', 'QC_ARG', 'HT_ARG', 'SZ_ARG', 'JP_ARG', 'SG_TOP_ARG', 'CG_ARG', 'JET_RECESS_ARG', 'VA_ARG', 'JC_ARG', 'TOP_BOTTOM_SG', 'MARKING_ARG'],
  'ARG_DIA_15 TO 25_SD': ['DESIGN_ARG', 'RM_ARG', 'OP10_TURNING_ARG', 'M1_ARG', 'BORING_ARG', 'HT_ARG', 'SZ_ARG', 'SD_ARG', 'QC_ARG', 'SG_TOP_ARG', 'CG_ARG', 'HO_ARG', 'JET_RECESS_ARG', 'VA_ARG', 'JC_ARG', 'TOP_BOTTOM_SG', 'MARKING_ARG'],
  'ARG_DIA_ABOVE_60_SD_DIRECT FINISH': ['DESIGN_ARG', 'RM_ARG', 'OP10_TURNING_ARG', 'M1_ARG', 'BORING_ARG', 'HT_ARG', 'SZ_ARG', 'SD_ARG', 'QC_ARG', 'SG_TOP_ARG', 'CG_ARG', 'JET_RECESS_ARG', 'VA_ARG', 'JC_ARG', 'TOP_BOTTOM_SG', 'MARKING_ARG'],
  'ARG_CARBIDE': ['DESIGN_ARG_CARBIDE', 'RM_ARG_CARBIDE', 'TURNING_ARG_CARBIDE', 'M1TR_ARG_CARBIDE', 'HT_ARG_CARBIDE', 'SUBZERO_ARG_CARBIDE', 'SG_ARG_CARBIDE', 'CG_ARG_CARBIDE', 'SHRINK_FIT_ARG_CARBIDE', 'SG_ARG_CARBIDE_2', 'CG_ID_OD_ARG_CARBIDE', 'SD_ARG_CARBIDE', 'HO_ARG_CARBIDE', 'A/E_SLOT_ARG_CARBIDE', 'CG_JET_RECESS_ARG_CARBIDE']
};

/**
 * Calculates the total cost of a defect report dynamically.
 * Total Cost = Material Cost + Labour Cost + Other Cost + Sum of Active Stage Costs.
 * 
 * Active stages represent the workflow path from the start up to the stage where failure occurred.
 *
 * @param report The DefectReport entity containing relations.
 * @returns Total calculated cost formatted as a 2-decimal rounded number.
 */
export function calculateTotalCost(report: DefectReport): number {
  const insp = report.inspectionDetail;
  const mat = Number(insp?.materialCost || 0);
  const lab = Number(insp?.labourCost || 0);
  const oth = Number(insp?.otherCost || 0);

  // Fallback to inspection detail values if not populated in primary report object
  const template = report.rejectionProcessTemplate || insp?.rejectionProcessTemplate;
  const failedStage = report.rejectionFailedStage || insp?.rejectionFailedStage;
  
  let stageCosts = report.rejectionStageCosts || insp?.rejectionStageCosts || {};
  // Handle database serialization edge case (if jsonb driver returns serialized string)
  if (typeof stageCosts === 'string') {
    try {
      stageCosts = JSON.parse(stageCosts);
    } catch {
      stageCosts = {};
    }
  }

  let stageTotal = 0;
  if (template && failedStage) {
    const stages = PROCESS_TEMPLATES[template] || [];
    const idx = stages.indexOf(failedStage);
    // Slice active stages up to and including the failed stage
    const activeStages = idx !== -1 ? stages.slice(0, idx + 1) : [];
    stageTotal = activeStages.reduce((sum, st) => sum + (Number(stageCosts[st]) || 0), 0);
  }

  return parseFloat((mat + lab + oth + Math.round(stageTotal)).toFixed(2));
}
