import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AutomationModel } from "../../src/business/automation";
import { buildAutomationModel } from "../../src/business/automation";
import { AutomationPage } from "../../src/pages/AutomationPage";
import { loadAutomation } from "../../src/services/automationService";

vi.mock("../../src/services/automationService", () => ({
	loadAutomation: vi.fn(),
}));

function model(): AutomationModel {
	return buildAutomationModel({
		arRecords: [],
		denials: [],
		exceptions: [],
		payments: [],
		interoperability: [],
	});
}

const pageProps = {
	workflowId: null,
	onOpenWorkflow: vi.fn(),
	onBack: vi.fn(),
	onOpenModule: vi.fn(),
	onOpenClaim: vi.fn(),
};

describe("AutomationPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(loadAutomation).mockResolvedValue(model());
	});

	it("renders the simulated KPI overview, workflow catalog, analysis, and no-run state", async () => {
		render(<AutomationPage {...pageProps} />);
		expect(
			await screen.findByRole("heading", { name: "Automation" }),
		).toBeInTheDocument();
		expect(screen.getByText("Configured Workflows")).toBeInTheDocument();
		expect(screen.getByText("Automation Workflows")).toBeInTheDocument();
		expect(screen.getByText("Automation Opportunities")).toBeInTheDocument();
		expect(
			screen.getByText("No execution history is available"),
		).toBeInTheDocument();
	});

	it("filters workflow catalog and opportunities by meaningful displayed fields", async () => {
		render(<AutomationPage {...pageProps} />);
		await screen.findByRole("heading", { name: "Automation" });
		fireEvent.change(screen.getByLabelText("Search workflows"), {
			target: { value: "837" },
		});
		expect(screen.getAllByText("837 error review routing")).toHaveLength(2);
		expect(screen.queryAllByText("Denial work queue routing")).toHaveLength(0);
		fireEvent.change(screen.getByLabelText("Search workflows"), {
			target: { value: "" },
		});
		fireEvent.change(screen.getByLabelText("Workstream"), {
			target: { value: "Payments" },
		});
		expect(
			screen.getAllByText("Unmatched 835 reconciliation identification"),
		).toHaveLength(2);
		expect(
			screen.queryAllByText("AR follow-up candidate identification"),
		).toHaveLength(0);
	});

	it("opens workflow detail and shows related module and execution limitation", async () => {
		const onOpenWorkflow = vi.fn();
		render(<AutomationPage {...pageProps} onOpenWorkflow={onOpenWorkflow} />);
		fireEvent.click(
			await screen.findByRole("button", {
				name: "AR follow-up candidate identification",
			}),
		);
		expect(onOpenWorkflow).toHaveBeenCalledWith("ar-follow-up");
		render(<AutomationPage {...pageProps} workflowId="ar-follow-up" />);
		expect(
			await screen.findByText(/configured\/simulated workflow definition/),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Open AR Management" }),
		).toBeInTheDocument();
	});

	it("exposes module drill-down and recoverable source errors", async () => {
		render(
			<AutomationPage {...pageProps} workflowId="payment-reconciliation" />,
		);
		await screen.findByRole("button", { name: "Open Payments" });
		fireEvent.click(screen.getByRole("button", { name: "Open Payments" }));
		expect(pageProps.onOpenModule).toHaveBeenCalledWith("Payments");
		vi.mocked(loadAutomation).mockRejectedValueOnce(
			new Error("Source unavailable"),
		);
		render(
			<AutomationPage {...pageProps} loadData={vi.mocked(loadAutomation)} />,
		);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Source unavailable",
		);
		expect(
			screen.getByRole("button", { name: "Try again" }),
		).toBeInTheDocument();
	});
});
