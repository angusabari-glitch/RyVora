import {
	buildAIHITLRecords,
	findAIHITLRecord,
	summarizeAIHITL,
} from "../business/aiHitl";
import { getApprovedClaimsDataset } from "../data/claimsDataset";
import { loadDenials } from "./denialsService";

/** AI/HITL is composed from approved AI_Recommendations, Denials, and Human_Reviews projections. */
export async function loadAIHITL() {
	const recommendations = buildAIHITLRecords(loadDenials());
	return {
		version: getApprovedClaimsDataset().version,
		recommendations,
		summary: summarizeAIHITL(recommendations),
	};
}

export async function loadAIHITLDetail(recommendationId: string) {
	const data = await loadAIHITL();
	return findAIHITLRecord(data.recommendations, recommendationId);
}
