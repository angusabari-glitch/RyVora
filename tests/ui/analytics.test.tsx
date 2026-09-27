import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAnalyticsModel } from "../../src/business/analytics";
import { AnalyticsPage } from "../../src/pages/AnalyticsPage";
import { loadAnalytics } from "../../src/services/analyticsService";
import { claim } from "../helpers/analyticsFixtures";

vi.mock("../../src/services/analyticsService", () => ({
	loadAnalytics: vi.fn(),
}));

function model() {
	return buildAnalyticsModel({
		claims: [claim()],
		denials: [],
		payments: [],
		arRecords: [],
		exceptions: [],
		interoperability: [],
		payers: [{ payerId: "P1", payerName: "Payer One" }],
	});
}

describe("AnalyticsPage", () => {
	beforeEach(() => {
		vi.mocked(loadAnalytics).mockReset();
		vi.mocked(loadAnalytics).mockResolvedValue(model());
	});

	it("renders the portfolio KPIs and analytical sections", async () => {
		render(<AnalyticsPage onOpenClaim={vi.fn()} />);
		expect(
			await screen.findByRole("heading", { name: "Analytics" }),
		).toBeInTheDocument();
		expect(screen.getByText("Cross-Module Analysis")).toBeInTheDocument();
		expect(screen.getByText("Payer Analytics")).toBeInTheDocument();
		expect(screen.getAllByText("1").length).toBeGreaterThan(0);
		expect(screen.getAllByText("$100.05").length).toBeGreaterThan(0);
	});

	it("passes supported global scope filters to the analytics service", async () => {
		render(<AnalyticsPage onOpenClaim={vi.fn()} />);
		await screen.findByRole("heading", { name: "Analytics" });
		fireEvent.change(screen.getByLabelText("Payer"), {
			target: { value: "P1" },
		});
		await waitFor(() =>
			expect(loadAnalytics).toHaveBeenLastCalledWith(
				expect.objectContaining({ payerId: "P1" }),
			),
		);
		fireEvent.change(screen.getByLabelText("Claim status"), {
			target: { value: "Denied" },
		});
		await waitFor(() =>
			expect(loadAnalytics).toHaveBeenLastCalledWith(
				expect.objectContaining({ payerId: "P1", claimStatus: "Denied" }),
			),
		);
		fireEvent.change(screen.getByLabelText("Service date from"), {
			target: { value: "2026-01-01" },
		});
		await waitFor(() =>
			expect(loadAnalytics).toHaveBeenLastCalledWith(
				expect.objectContaining({
					payerId: "P1",
					claimStatus: "Denied",
					serviceDateFrom: "2026-01-01",
				}),
			),
		);
	});

	it("drills from a priority claim to the existing Claims module", async () => {
		const onOpenClaim = vi.fn();
		render(<AnalyticsPage onOpenClaim={onOpenClaim} />);
		fireEvent.click(await screen.findByRole("button", { name: "CLM-1" }));
		expect(onOpenClaim).toHaveBeenCalledWith("CLM-1");
	});

	it("shows an empty state when the selected analytical population has no claims", async () => {
		vi.mocked(loadAnalytics).mockResolvedValue(
			buildAnalyticsModel({
				claims: [],
				denials: [],
				payments: [],
				arRecords: [],
				exceptions: [],
				interoperability: [],
				payers: [],
			}),
		);
		render(<AnalyticsPage onOpenClaim={vi.fn()} />);
		expect(
			await screen.findByText("No claims in this scope"),
		).toBeInTheDocument();
	});

	it("shows a recoverable error state when source services fail", async () => {
		vi.mocked(loadAnalytics).mockRejectedValue(new Error("Source unavailable"));
		render(<AnalyticsPage onOpenClaim={vi.fn()} />);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Source unavailable",
		);
		expect(
			screen.getByRole("button", { name: "Try again" }),
		).toBeInTheDocument();
	});
});
