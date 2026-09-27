export interface ClaimFact {
	claimId: string;
	payerId: string;
	billedAmount: number | null;
	status: string;
	priority: string;
	arAge: number | null;
}

export interface PayerFact {
	payerId: string;
	payerName: string;
}

export interface DenialFact {
	claimId: string;
	denialCode: string;
	reason: string;
	category: string;
	denialAmount: number | null;
}

export interface ArFact {
	claimId: string;
	originalBalance: number | null;
	currentBalance: number | null;
	arAge: number | null;
	agingBucket: string;
	status: string;
}

export interface ExceptionFact {
	exceptionId: string;
	claimId: string;
	severity: string;
	status: string;
	type: string;
	description: string;
	owner: string;
}

export interface ApprovedDashboardDataset {
	version: string;
	validationTargets: {
		claimCount: number;
		billedAmount: number;
		deniedClaims: number;
		denialRatePercent: number;
		averageArAgeDays: number;
		averageArAgeToleranceDays: number;
	};
	claims: ClaimFact[];
	payers: PayerFact[];
	denials: DenialFact[];
	arRecords: ArFact[];
	exceptions: ExceptionFact[];
}
