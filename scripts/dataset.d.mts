export interface DatasetRecord {
	[key: string]: unknown;
}

export interface WorkbookSheetData {
	columns: string[];
	records: DatasetRecord[];
}

export interface DatasetSchema {
	sheets: Record<
		string,
		{ columns: string[]; records: number; [key: string]: unknown }
	>;
	relationships: Array<[string, string, string, string]>;
	claimStatuses: string[];
	validationTargets: {
		claimCount: number;
		billedAmount: number;
		deniedClaims: number;
		denialRatePercent: number;
		averageArAgeDays: number;
		averageArAgeToleranceDays: number;
	};
	[key: string]: unknown;
}

export interface DatasetValidationReport {
	errors: string[];
	warnings: string[];
	counts: Record<string, number>;
	kpis: Record<string, number>;
	summaryClassification?: string;
	summaryReconciliation: Array<{
		label: string;
		baselineCount: number;
		v1_2Sheet: string;
		v1_2Count: number;
	}>;
}

export interface ValidatedWorkbookBundle {
	manifest: {
		datasetId: string;
		version: string;
	};
	verifiedFiles: Array<{
		path: string;
		sourcePath: string;
		sha256: string;
	}>;
	workbookData: Record<string, WorkbookSheetData | undefined>;
	report: DatasetValidationReport;
}

export function resolveManifestPath(
	rootDirectory: string,
	relativePath: string,
): string;

export function readWorkbook(
	filePath: string,
	schema: DatasetSchema,
): Promise<Record<string, WorkbookSheetData | undefined>>;

export function validateDataset(
	data: Record<string, WorkbookSheetData | undefined>,
	schema: DatasetSchema,
): DatasetValidationReport;

export function validateBundle(
	sourceDirectory: string,
	schema: DatasetSchema,
	options?: { allowKpiMismatch?: boolean },
): Promise<ValidatedWorkbookBundle>;
