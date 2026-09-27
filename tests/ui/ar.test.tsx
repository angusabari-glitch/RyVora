import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";
import { ARManagementPage } from "../../src/pages/ARManagementPage";
import type { ArManagementData } from "../../src/services/arService";
import { loadArManagement } from "../../src/services/arService";

async function openArManagement() {
	render(<App />);
	await screen.findByRole("heading", { name: "Executive Dashboard" });
	fireEvent.click(screen.getByRole("button", { name: "AR Management" }));
	await screen.findByRole("heading", { name: "AR Management" });
}

describe("AR Management UI", () => {
	it("renders data-derived KPI values and source aging distribution", async () => {
		await openArManagement();
		const kpis = screen.getByRole("region", {
			name: "AR performance indicators",
		});
		expect(
			within(kpis).getByText("1,000", { exact: true }),
		).toBeInTheDocument();
		expect(
			within(kpis).getByText("$2,498,225.77", { exact: true }),
		).toBeInTheDocument();
		expect(
			within(kpis).getByText("32.35 days", { exact: true }),
		).toBeInTheDocument();
		expect(within(kpis).getByText("590", { exact: true })).toBeInTheDocument();
		expect(
			screen.getByRole("region", { name: "AR aging analysis" }),
		).toHaveTextContent("0-30 days");
		expect(
			screen.getByRole("region", { name: "AR work queue" }),
		).toBeInTheDocument();
	});

	it("searches, combines filters, sorts, and paginates the work queue", async () => {
		await openArManagement();
		const data = await loadArManagement();
		const target = data.records.find(
			(record) =>
				record.followUpRequired && record.agingBucket && record.claim?.payerId,
		);
		expect(target).toBeDefined();
		if (!target?.agingBucket || !target.claim?.payerId || !target.status)
			return;
		fireEvent.change(screen.getByRole("searchbox", { name: /Search AR ID/ }), {
			target: { value: target.arId.toLowerCase() },
		});
		fireEvent.change(screen.getByRole("combobox", { name: "AR Status" }), {
			target: { value: target.status },
		});
		fireEvent.change(screen.getByRole("combobox", { name: "Aging Bucket" }), {
			target: { value: target.agingBucket },
		});
		fireEvent.change(screen.getByRole("combobox", { name: "Payer" }), {
			target: { value: target.claim.payerId },
		});
		fireEvent.change(screen.getByRole("combobox", { name: "Follow-Up" }), {
			target: { value: "required" },
		});
		expect(screen.getByText("Showing 1–1 of 1 AR records")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: /Clear filters/ }));
		const table = screen.getByRole("region", { name: "AR work queue results" });
		fireEvent.click(within(table).getByRole("button", { name: "AR Age" }));
		expect(
			within(table).getByRole("columnheader", { name: "AR Age" }),
		).toHaveAttribute("aria-sort", "ascending");
		fireEvent.click(screen.getByRole("button", { name: "Next" }));
		expect(
			screen.getByText("Showing 26–50 of 1,000 AR records"),
		).toBeInTheDocument();
		expect(screen.getByText("Page 2 of 40")).toBeInTheDocument();
	});

	it("keeps business-layer priority ordering in the rendered table", async () => {
		const source = await loadArManagement();
		const selected = ["Critical", "High", "Routine", "No follow-up"].map(
			(priority) =>
				source.records.find((record) => record.priority === priority),
		);
		expect(selected.every(Boolean)).toBe(true);
		const loadData = () =>
			Promise.resolve({
				...source,
				records: selected.filter(
					(row): row is NonNullable<typeof row> => row !== undefined,
				),
			});
		render(<ARManagementPage onOpenClaim={vi.fn()} loadData={loadData} />);
		await screen.findByRole("heading", { name: "AR Management" });
		const table = screen.getByRole("region", { name: "AR work queue results" });
		fireEvent.click(within(table).getByRole("button", { name: "Priority" }));
		const priorities = within(table)
			.getAllByRole("row")
			.slice(1)
			.map(
				(row) =>
					within(row).getAllByText(/Critical|High|Routine|No follow-up/)[0]
						.textContent,
			);
		expect(priorities).toEqual(["Critical", "High", "Routine", "No follow-up"]);
	});

	it("opens AR detail with claim, payment, denial, and exception context", async () => {
		await openArManagement();
		const data = await loadArManagement();
		const target = data.records.find((record) => record.exceptions.length > 0);
		expect(target).toBeDefined();
		if (!target) return;
		fireEvent.change(screen.getByRole("searchbox", { name: /Search AR ID/ }), {
			target: { value: target.arId },
		});
		fireEvent.click(
			screen.getByRole("button", { name: `Open AR ${target.arId}` }),
		);
		expect(
			await screen.findByRole("heading", { name: "AR Detail" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("region", { name: "AR overview" }),
		).toHaveTextContent(target.claimId);
		expect(
			screen.getByRole("region", { name: "Linked payments and denial" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("region", { name: "Linked exceptions" }),
		).toHaveTextContent(target.exceptions[0].exceptionId);
		fireEvent.click(screen.getByRole("button", { name: "Open Claim Detail" }));
		expect(
			await screen.findByRole("heading", { name: "Claim Detail" }),
		).toBeInTheDocument();
		expect(screen.getByText(target.claimId)).toBeInTheDocument();
	});

	it("shows a loading state while the service is pending", () => {
		const loadData = () => new Promise<ArManagementData>(() => {});
		render(<ARManagementPage onOpenClaim={vi.fn()} loadData={loadData} />);
		expect(screen.getByRole("status")).toHaveTextContent(
			"Loading AR Management",
		);
	});

	it("shows an empty state for an empty AR dataset", async () => {
		const emptyData: ArManagementData = {
			records: [],
			summary: {
				totalRecords: 0,
				totalCurrentBalance: null,
				averageAge: null,
				followUpPopulation: 0,
			},
			agingGroups: [],
		};
		const loadData = () => Promise.resolve(emptyData);
		render(<ARManagementPage onOpenClaim={vi.fn()} loadData={loadData} />);
		expect(await screen.findByText("No AR records found")).toBeInTheDocument();
		expect(
			screen.getByText("No AR records are available in the approved dataset."),
		).toBeInTheDocument();
	});

	it("shows an error and retries instead of treating a failed load as empty", async () => {
		let attempts = 0;
		const loadData = () => {
			attempts += 1;
			return attempts === 1
				? Promise.reject(new Error("AR source unavailable"))
				: loadArManagement();
		};
		render(<ARManagementPage onOpenClaim={vi.fn()} loadData={loadData} />);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"AR source unavailable",
		);
		fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(
			await screen.findByRole("heading", { name: "AR Management" }),
		).toBeInTheDocument();
		expect(attempts).toBe(2);
	});
});
