export type WorkbookRecord = Record<string, unknown>;

export interface CompactWorkbookRows {
	fields: string[];
	rows: unknown[][];
}

export interface CompactApprovedClaimsDataset {
	version: string;
	claims: CompactWorkbookRows;
	patients: CompactWorkbookRows;
	providers: CompactWorkbookRows;
	payers: CompactWorkbookRows;
	transactions837: CompactWorkbookRows;
	payments835: CompactWorkbookRows;
	denials: CompactWorkbookRows;
	aiRecommendations: CompactWorkbookRows;
	humanReviews: CompactWorkbookRows;
	arRecords: CompactWorkbookRows;
	exceptions: CompactWorkbookRows;
}

export interface ApprovedClaimsDataset {
	version: string;
	claims: WorkbookRecord[];
	patients: WorkbookRecord[];
	providers: WorkbookRecord[];
	payers: WorkbookRecord[];
	transactions837: WorkbookRecord[];
	payments835: WorkbookRecord[];
	denials: WorkbookRecord[];
	aiRecommendations: WorkbookRecord[];
	humanReviews: WorkbookRecord[];
	arRecords: WorkbookRecord[];
	exceptions: WorkbookRecord[];
}

export interface ClaimPayment {
	paymentId: string;
	transactionId: string;
	allowedAmount: number | null;
	paidAmount: number | null;
	adjustmentAmount: number | null;
	matchStatus: string | null;
	paymentDate: string | null;
}

export interface ClaimTransaction837 {
	transactionId: string;
	type: string | null;
	status: string | null;
	rejectionCode: string | null;
	rejectionReason: string | null;
	submissionDate: string | null;
	responseDate: string | null;
}

export interface ClaimDenial {
	denialId: string;
	code: string | null;
	reason: string | null;
	category: string | null;
	amount: number | null;
	date: string | null;
	appealStatus: string | null;
	resolutionStatus: string | null;
}

export interface ClaimRecord {
	claimId: string;
	patientId: string;
	providerId: string;
	providerName: string | null;
	payerId: string;
	payerName: string | null;
	serviceDate: string | null;
	submissionDate: string | null;
	claimType: string | null;
	insuranceType: string | null;
	billedAmount: number | null;
	allowedAmount: number | null;
	paidAmount: number | null;
	outstandingAmount: number | null;
	status: string;
	arStatus: string | null;
	arAge: number | null;
	priority: string | null;
	followUpRequired: boolean;
	nextAction: string | null;
	currentOwner: string | null;
	arAgingBucket: string | null;
	transaction837: ClaimTransaction837 | null;
	payments: ClaimPayment[];
	denial: ClaimDenial | null;
}

export interface ClaimFilters {
	search: string;
	status: string;
	insuranceType: string;
	arStatus: string;
	followUp: "all" | "required" | "not-required";
	serviceDateFrom: string;
	serviceDateTo: string;
}

export interface ClaimSort {
	field: keyof ClaimRecord;
	direction: "ascending" | "descending";
}

export interface ClaimPage<T> {
	items: T[];
	page: number;
	pageSize: number;
	totalItems: number;
	totalPages: number;
}
