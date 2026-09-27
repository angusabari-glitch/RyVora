import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";
import { InteroperabilityPage } from "../../src/pages/InteroperabilityPage";
import type { InteroperabilityData } from "../../src/services/interoperabilityService";
import { loadInteroperability } from "../../src/services/interoperabilityService";

const noop = () => {};

beforeEach(() => {
	window.history.replaceState({}, "", "/");
});

afterEach(() => {
	window.history.replaceState({}, "", "/");
});

async function openInteroperability() {
	render(<App />);
	await screen.findByRole("heading", { name: "Executive Dashboard" });
	fireEvent.click(screen.getByRole("button", { name: "Interoperability" }));
	await screen.findByRole("heading", { name: "Interoperability" });
}

describe("Interoperability UI", () => {
	it("opens from navigation and renders KPIs and source-backed analysis", async () => {
		await openInteroperability();
		expect(window.location.pathname).toBe("/interoperability");
		const navItem = screen.getByRole("button", { name: "Interoperability" });
		expect(navItem).toHaveAttribute("aria-current", "page");
		expect(navItem).not.toHaveTextContent("Soon");
		const kpis = screen.getByRole("region", {
			name: "Interoperability operational summary",
		});
		expect(
			within(kpis).getByText("1,000", { exact: true }),
		).toBeInTheDocument();
		expect(within(kpis).getByText("900", { exact: true })).toBeInTheDocument();
		expect(within(kpis).getByText("100", { exact: true })).toBeInTheDocument();
		expect(
			within(kpis).getByText("90.0%", { exact: true }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("region", { name: "Interface Health" }),
		).toHaveTextContent("Accepted");
		expect(
			screen.getByRole("region", { name: "Transaction type analysis" }),
		).toHaveTextContent("837P");
		expect(
			screen.getByRole("region", { name: "Interoperability work queue" }),
		).toBeInTheDocument();
	});

	it("combines search and filters, filters unavailable dimensions honestly, and paginates", async () => {
		await openInteroperability();
		const data = await loadInteroperability();
		const rejected = data.records.find(
			(record) => record.status === "Rejected" && record.rejectionCode,
		);
		expect(rejected).toBeDefined();
		if (!rejected) return;
		fireEvent.change(
			screen.getByRole("searchbox", {
				name: /Search transaction ID/,
			}),
			{ target: { value: rejected.transactionId.toLowerCase() } },
		);
		fireEvent.change(screen.getByRole("combobox", { name: "Status" }), {
			target: { value: "Rejected" },
		});
		fireEvent.change(
			screen.getByRole("combobox", { name: "Transaction Type" }),
			{ target: { value: "837P" } },
		);
		fireEvent.change(
			screen.getByRole("combobox", { name: "Error / Exception" }),
			{ target: { value: "Error recorded" } },
		);
		expect(
			screen.getByText("Showing 1–1 of 1 interoperability records"),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: /Clear filters/ }));
		fireEvent.change(screen.getByRole("combobox", { name: "Interface" }), {
			target: { value: "Not recorded" },
		});
		expect(
			screen.getByText("Showing 1–25 of 1,000 interoperability records"),
		).toBeInTheDocument();
		fireEvent.change(screen.getByRole("combobox", { name: "Rows per page" }), {
			target: { value: "25" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Next" }));
		expect(
			screen.getByText("Showing 26–50 of 1,000 interoperability records"),
		).toBeInTheDocument();
	});

	it("opens a transaction detail route and follows its linked claim", async () => {
		await openInteroperability();
		const data = await loadInteroperability();
		const target = data.records.find((record) => record.claim);
		expect(target).toBeDefined();
		if (!target) return;
		fireEvent.click(
			screen.getByRole("button", {
				name: `Open transaction ${target.transactionId}`,
			}),
		);
		await screen.findByRole("heading", { name: "Interoperability Detail" });
		expect(window.location.pathname).toBe(
			`/interoperability/${target.transactionId}`,
		);
		expect(
			screen.getByRole("region", { name: "Transaction overview" }),
		).toHaveTextContent(target.transactionId);
		fireEvent.click(
			screen.getByRole("button", { name: `Open claim ${target.claimId}` }),
		);
		await screen.findByRole("heading", { name: "Claim Detail" });
		expect(screen.getByText(target.claimId)).toBeInTheDocument();
	});

	it("supports direct detail URLs and browser back navigation", async () => {
		const data = await loadInteroperability();
		const target = data.records[0];
		if (!target)
			throw new Error("Expected source interoperability transaction");
		window.history.replaceState(
			{},
			"",
			`/interoperability/${encodeURIComponent(target.transactionId)}`,
		);
		render(<App />);
		await screen.findByRole("heading", { name: "Interoperability Detail" });
		fireEvent.click(
			screen.getByRole("button", { name: /Back to Interoperability/ }),
		);
		await screen.findByRole("heading", { name: "Interoperability" });
		expect(window.location.pathname).toBe("/interoperability");
	});

	it("shows an empty state for an unknown transaction and retries loading errors", async () => {
		const data = await loadInteroperability();
		const emptyRoute = render(
			<InteroperabilityPage
				transactionId="UNKNOWN-TXN"
				onOpenTransaction={noop}
				onBackToQueue={noop}
				onOpenClaim={noop}
				loadData={() => Promise.resolve(data)}
			/>,
		);
		await screen.findByText(
			/No approved transaction was found for UNKNOWN-TXN/,
		);
		emptyRoute.unmount();

		const loader = vi
			.fn<() => Promise<InteroperabilityData>>()
			.mockRejectedValueOnce(new Error("Source projection unavailable"))
			.mockResolvedValue(data);
		render(
			<InteroperabilityPage
				transactionId={null}
				onOpenTransaction={noop}
				onBackToQueue={noop}
				onOpenClaim={noop}
				loadData={loader}
			/>,
		);
		await screen.findByText("Source projection unavailable");
		fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		await screen.findByRole("heading", { name: "Interoperability" });
		expect(loader).toHaveBeenCalledTimes(2);
	});
});
