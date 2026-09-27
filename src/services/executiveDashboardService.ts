import { buildExecutiveDashboardModel } from "../business/executiveDashboard";
import { getApprovedDashboardDataset } from "../data/dashboardDataset";

export async function loadExecutiveDashboard() {
	return buildExecutiveDashboardModel(getApprovedDashboardDataset());
}
