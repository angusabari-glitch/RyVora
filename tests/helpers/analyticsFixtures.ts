import type { ArRecord } from "../../src/business/ar";
import type { DenialRecord } from "../../src/business/denials";
import type { ExceptionRecord } from "../../src/business/exceptions";
import type { InteroperabilityRecord } from "../../src/business/interoperability";
import type { PaymentRecord } from "../../src/business/payments";
import type { ClaimRecord } from "../../src/data/claimsTypes";

export function claim(overrides: Partial<ClaimRecord> = {}): ClaimRecord {
	return {
		claimId: "CLM-1",
		patientId: "SYN-P1",
		providerId: "PR1",
		providerName: "Provider One",
		payerId: "P1",
		payerName: "Payer One",
		serviceDate: "2026-01-10",
		submissionDate: "2026-01-12",
		claimType: "Professional",
		insuranceType: "Commercial",
		billedAmount: 100.05,
		allowedAmount: 80,
		paidAmount: 50,
		outstandingAmount: 50,
		status: "Denied",
		arStatus: "Active",
		arAge: 45,
		priority: "High",
		followUpRequired: true,
		nextAction: "Follow Up",
		currentOwner: "Ops",
		arAgingBucket: "31-60",
		transaction837: null,
		payments: [],
		denial: null,
		...overrides,
	};
}

export function denial(overrides: Partial<DenialRecord> = {}): DenialRecord {
	return {
		denialId: "DEN-1",
		claimId: "CLM-1",
		claim: claim(),
		code: "CO-1",
		reason: "Authorization",
		category: "Clinical",
		deniedAmount: 80,
		date: "2026-01-15",
		appealStatus: "Pending",
		correctiveAction: null,
		resolutionStatus: "Open",
		legacyRecommendation: null,
		legacyConfidence: null,
		aiRecommendation: null,
		humanReviews: [],
		followUpRequired: true,
		reviewStatus: "Pending",
		...overrides,
	};
}

export function payment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
	return {
		paymentId: "PAY-1",
		claimId: "CLM-1",
		payerId: "P1",
		payerName: "Payer One",
		transactionId: "835-1",
		paymentDate: "2026-02-01",
		billedAmount: 100.05,
		allowedAmount: 80,
		paidAmount: 50,
		adjustmentAmount: 30,
		reconciliationStatus: "Matched",
		claim: claim(),
		billedVariance: 0,
		...overrides,
	};
}

export function arRecord(overrides: Partial<ArRecord> = {}): ArRecord {
	return {
		arId: "AR-1",
		claimId: "CLM-1",
		originalBalance: 100.05,
		currentBalance: 50,
		arAge: 45,
		agingBucket: "31-60",
		status: "Active",
		nextAction: "Follow Up",
		owner: "Ops",
		adjustmentAmount: 0,
		reconciliationStatus: "Unmatched",
		claim: claim(),
		exceptions: [],
		followUpRequired: true,
		priority: "High",
		priorityReason: "Test fixture",
		...overrides,
	};
}

export function exception(
	overrides: Partial<ExceptionRecord> = {},
): ExceptionRecord {
	return {
		exceptionId: "EXC-1",
		claimId: "CLM-1",
		type: "837 Rejection",
		severity: "High",
		description: "Source exception",
		owner: "Ops",
		status: "Open",
		createdDate: "2026-01-20",
		sourceModule: "Interoperability",
		followUpRequired: true,
		claim: claim(),
		transaction: null,
		payments: [],
		arRecords: [],
		denials: [],
		...overrides,
	};
}

export function interoperability(
	overrides: Partial<InteroperabilityRecord> = {},
): InteroperabilityRecord {
	return {
		transactionId: "TXN-1",
		claimId: "CLM-1",
		transactionType: "837P",
		status: "Accepted",
		interfaceName: null,
		sourceSystem: null,
		destinationSystem: null,
		direction: null,
		owner: null,
		createdDate: null,
		submissionDate: "2026-01-12",
		responseDate: "2026-01-13",
		rejectionCode: null,
		errorMessage: null,
		errorState: "No error recorded",
		claim: claim(),
		arRecords: [],
		payments: [],
		denials: [],
		exceptions: [],
		...overrides,
	};
}
