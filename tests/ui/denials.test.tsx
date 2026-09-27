import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../src/app/App";
import { loadDenials } from "../../src/services/denialsService";

async function openDenials() {
	render(<App />);
	await screen.findByRole("heading", { name: "Executive Dashboard" });
	fireEvent.click(screen.getByRole("button", { name: /Denials/ }));
	await screen.findByRole("heading", { name: /^Denials$/ });
	expect(document.title).toBe("Denials | RyVora");
}

describe("Denials Workbench and Detail", () => {
	it("renders calculated denial KPIs and the data-derived reason analysis", async () => {
		await openDenials();
		expect(screen.getByText("290 denial records")).toBeInTheDocument();
		expect(screen.getByText("29.0%")).toBeInTheDocument();
		const kpis = screen.getByRole("region", {
			name: "Denial performance indicators",
		});
		expect(within(kpis).getByText("290", { exact: true })).toBeInTheDocument();
		expect(
			within(kpis).getByText("$1,052,883.40", { exact: true }),
		).toBeInTheDocument();
		expect(within(kpis).getByText("120", { exact: true })).toBeInTheDocument();
		const reasonAnalysis = screen.getByRole("region", {
			name: "Denial reason analysis",
		});
		expect(within(reasonAnalysis).getByText("Deductible")).toBeInTheDocument();
		expect(
			within(reasonAnalysis).getByLabelText(/Deductible, 90, 31.0 percent/),
		).toBeInTheDocument();
		expect(
			screen.getByRole("region", { name: "Denial workbench" }),
		).toBeInTheDocument();
		expect(
			screen.getAllByRole("button", { name: /^Open denial / }),
		).toHaveLength(25);
	});

	it("searches actual denial identifiers and provides a clear no-match state", async () => {
		await openDenials();
		const first = loadDenials()[0];
		const search = screen.getByRole("searchbox", { name: /Search denials/ });
		fireEvent.change(search, {
			target: { value: first.denialId.toLowerCase() },
		});
		expect(screen.getByText("Showing 1–1 of 1 denials")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: `Open denial ${first.denialId}` }),
		).toBeInTheDocument();
		fireEvent.change(search, { target: { value: "definitely-not-a-denial" } });
		expect(screen.getByText("No denials found")).toBeInTheDocument();
	});

	it("combines payer, follow-up, and human-review filters", async () => {
		await openDenials();
		const row = loadDenials().find(
			(denial) =>
				denial.claim?.payerName &&
				denial.followUpRequired &&
				denial.reviewStatus === "Pending",
		);
		expect(row?.claim?.payerName).toBeTruthy();
		if (!row?.claim?.payerName) return;
		fireEvent.change(screen.getByRole("combobox", { name: "Payer" }), {
			target: { value: row.claim.payerName },
		});
		fireEvent.change(
			screen.getByRole("combobox", { name: "Follow-Up Required" }),
			{ target: { value: "required" } },
		);
		fireEvent.change(screen.getByRole("combobox", { name: "Human Review" }), {
			target: { value: "Pending" },
		});
		const table = screen.getByRole("region", {
			name: "Denial workbench results",
		});
		expect(
			within(table).getAllByRole("button", { name: /^Open denial/ }).length,
		).toBeGreaterThan(0);
		expect(screen.getByText(/Clear filters/)).toBeInTheDocument();
	});

	it("opens denial detail with linked AI and human-review records", async () => {
		await openDenials();
		const target = loadDenials().find(
			(denial) => denial.aiRecommendation && denial.humanReviews.length > 0,
		);
		expect(target).toBeDefined();
		if (!target) return;
		fireEvent.change(
			screen.getByRole("searchbox", { name: /Search denials/ }),
			{ target: { value: target.denialId } },
		);
		fireEvent.click(
			screen.getByRole("button", { name: `Open denial ${target.denialId}` }),
		);
		expect(
			await screen.findByRole("heading", { name: "Denial Detail" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("region", { name: "AI recommendation" }),
		).toHaveTextContent(target.aiRecommendation?.text ?? "");
		expect(
			screen.getByRole("region", { name: "Human review" }),
		).toHaveTextContent(target.humanReviews[0].decision ?? "");
		expect(
			screen.getByText(
				"AI recommendation ≠ final human decision. This view is read-only; the AI does not resolve or update the denial.",
			),
		).toBeInTheDocument();
	});

	it("shows a pending review state and opens the related Claims detail", async () => {
		await openDenials();
		const target = loadDenials().find(
			(denial) =>
				denial.claim &&
				denial.aiRecommendation &&
				denial.humanReviews.length === 0,
		);
		expect(target).toBeDefined();
		if (!target) return;
		fireEvent.change(
			screen.getByRole("searchbox", { name: /Search denials/ }),
			{ target: { value: target.denialId } },
		);
		fireEvent.click(
			screen.getByRole("button", { name: `Open denial ${target.denialId}` }),
		);
		expect(await screen.findByText("Human review pending")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Open Claim Detail" }));
		expect(
			await screen.findByRole("heading", { name: "Claim Detail" }),
		).toBeInTheDocument();
		expect(screen.getByText(target.claimId)).toBeInTheDocument();
	});

	it("returns from detail to the denial workbench", async () => {
		await openDenials();
		const denial = loadDenials()[0];
		fireEvent.click(
			screen.getByRole("button", { name: `Open denial ${denial.denialId}` }),
		);
		await screen.findByRole("heading", { name: "Denial Detail" });
		fireEvent.click(screen.getByRole("button", { name: /Back to Denials/ }));
		expect(
			await screen.findByRole("heading", { name: /^Denials$/ }),
		).toBeInTheDocument();
	});
});
