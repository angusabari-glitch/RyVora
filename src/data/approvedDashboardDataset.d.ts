declare module "virtual:ryvora-approved-dashboard-dataset" {
	const dataset: import("./dashboardTypes").ApprovedDashboardDataset;
	export default dataset;
}

declare module "virtual:ryvora-approved-claims-dataset" {
	const dataset: import("./claimsTypes").CompactApprovedClaimsDataset;
	export default dataset;
}
