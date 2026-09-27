import {
	buildExceptionRecords,
	findExceptionById,
	getExceptionSummary,
	groupExceptionsByType,
} from "../business/exceptions";
import { getApprovedClaimsDataset } from "../data/claimsDataset";
import { loadArManagement } from "./arService";
import { loadClaims } from "./claimsService";
import { loadDenials } from "./denialsService";
import { loadPayments } from "./paymentsService";

export interface ExceptionsData {
	records: ReturnType<typeof buildExceptionRecords>;
	summary: ReturnType<typeof getExceptionSummary>;
	typeGroups: ReturnType<typeof groupExceptionsByType>;
}

/** Assemble a read-only exceptions view from approved data and existing services. */
export async function loadExceptions(): Promise<ExceptionsData> {
	const [arData] = await Promise.all([loadArManagement()]);
	const records = buildExceptionRecords(
		getApprovedClaimsDataset(),
		loadClaims(),
		loadPayments(),
		loadDenials(),
		arData.records,
	);
	return {
		records,
		summary: getExceptionSummary(records),
		typeGroups: groupExceptionsByType(records),
	};
}

export async function loadExceptionDetail(exceptionId: string) {
	const data = await loadExceptions();
	return findExceptionById(data.records, exceptionId);
}
