import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../src/app/App";
import { loadPayments } from "../../src/services/paymentsService";

async function openPayments() {
	render(<App />);
	await screen.findByRole("heading", { name: "Executive Dashboard" });
	fireEvent.click(screen.getByRole("button", { name: /^Payments$/ }));
	await screen.findByRole("heading", { name: /^Payments$/ });
}

describe("Payments workbench and detail UI", () => {
	it("renders calculated 835 KPIs and source reconciliation counts", async () => {
		await openPayments();
		expect(screen.getByText("520 payment records")).toBeInTheDocument();
		const kpis = screen.getByRole("region", {
			name: "Payment performance indicators",
		});
		expect(within(kpis).getByText("520", { exact: true })).toBeInTheDocument();
		expect(
			within(kpis).getByText("$2,121,910.42", { exact: true }),
		).toBeInTheDocument();
		expect(
			within(kpis).getByText("$2,278,559.44", { exact: true }),
		).toBeInTheDocument();
		expect(
			within(kpis).getByText("90.4%", { exact: true }),
		).toBeInTheDocument();
		expect(
			screen.getByText(/835 records are marked unmatched/),
		).toBeInTheDocument();
	});

	it("searches payment identifiers and filters by source reconciliation status", async () => {
		await openPayments();
		const target = loadPayments().find(
			(payment) => payment.reconciliationStatus === "Unmatched",
		);
		expect(target).toBeDefined();
		if (!target) return;
		fireEvent.change(
			screen.getByRole("searchbox", { name: /Search by payment ID/ }),
			{ target: { value: target.transactionId.toLowerCase() } },
		);
		expect(screen.getByText("Showing 1–1 of 1 payments")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: `Open payment ${target.paymentId}` }),
		).toBeInTheDocument();
		fireEvent.change(
			screen.getByRole("searchbox", { name: /Search by payment ID/ }),
			{
				target: { value: "" },
			},
		);
		fireEvent.change(
			screen.getByRole("combobox", { name: "835 Match Status" }),
			{
				target: { value: "Unmatched" },
			},
		);
		expect(screen.getByText("Showing 1–25 of 50 payments")).toBeInTheDocument();
	});

	it("sorts and paginates the workbench", async () => {
		await openPayments();
		const table = screen.getByRole("region", {
			name: "Payments workbench results",
		});
		fireEvent.click(within(table).getByRole("button", { name: "Paid Amount" }));
		expect(
			within(table).getByRole("columnheader", { name: "Paid Amount" }),
		).toHaveAttribute("aria-sort", "ascending");
		fireEvent.click(screen.getByRole("button", { name: "Next" }));
		expect(
			screen.getByText("Showing 26–50 of 520 payments"),
		).toBeInTheDocument();
		expect(screen.getByText("Page 2 of 21")).toBeInTheDocument();
	});

	it("opens detail with financial reconciliation, source 835 fields, and claim navigation", async () => {
		await openPayments();
		const target = loadPayments().find(
			(payment) => payment.paymentId === "PMT6004",
		);
		expect(target?.claim).toBeTruthy();
		fireEvent.change(
			screen.getByRole("searchbox", { name: /Search by payment ID/ }),
			{ target: { value: "PMT6004" } },
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Open payment PMT6004" }),
		);
		expect(
			await screen.findByRole("heading", { name: "Payment Detail" }),
		).toBeInTheDocument();
		expect(screen.getByText("Financial Reconciliation")).toBeInTheDocument();
		expect(screen.getByText("Billed Amount Variance")).toBeInTheDocument();
		const financial = screen.getByRole("region", {
			name: "Financial reconciliation",
		});
		expect(within(financial).getAllByText("$0.00").length).toBeGreaterThan(0);
		expect(
			within(financial).getByText("Patient Responsibility"),
		).toBeInTheDocument();
		expect(
			within(financial).getByText("Not available in approved v1.2 data"),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Open Claim Detail" }));
		expect(
			await screen.findByRole("heading", { name: "Claim Detail" }),
		).toBeInTheDocument();
		expect(screen.getByText("CLM1004")).toBeInTheDocument();
	});

	it("returns from payment detail to the workbench", async () => {
		await openPayments();
		fireEvent.change(
			screen.getByRole("searchbox", { name: /Search by payment ID/ }),
			{ target: { value: "PMT6004" } },
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Open payment PMT6004" }),
		);
		await screen.findByRole("heading", { name: "Payment Detail" });
		fireEvent.click(screen.getByRole("button", { name: /Back to Payments/ }));
		expect(
			await screen.findByRole("heading", { name: /^Payments$/ }),
		).toBeInTheDocument();
	});
});
