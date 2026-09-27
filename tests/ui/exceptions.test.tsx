import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";
import { ExceptionsPage } from "../../src/pages/ExceptionsPage";
import type { ExceptionsData } from "../../src/services/exceptionsService";
import { loadExceptions } from "../../src/services/exceptionsService";

const noop = () => {};

async function openExceptionsInApp() {
	render(<App />);
	await screen.findByRole("heading", { name: "Executive Dashboard" });
	fireEvent.click(screen.getByRole("button", { name: "Exceptions" }));
	await screen.findByRole("heading", { name: "Exceptions" });
}

describe("Exceptions UI", () => {
	it("renders the source-backed KPIs, type analysis, and work queue", async () => {
		await openExceptionsInApp();
		const kpis = screen.getByRole("region", {
			name: "Exception performance indicators",
		});
		expect(within(kpis).getAllByText("180", { exact: true })).toHaveLength(2);
		expect(within(kpis).getByText("90", { exact: true })).toBeInTheDocument();
		expect(within(kpis).getByText("10", { exact: true })).toBeInTheDocument();
		expect(
			screen.getByRole("region", { name: "Exception type analysis" }),
		).toHaveTextContent("837 Rejection");
		expect(
			screen.getByRole("region", { name: "Exception work queue" }),
		).toBeInTheDocument();
	});

	it("searches, combines filters, sorts, and paginates the queue", async () => {
		await openExceptionsInApp();
		const data = await loadExceptions();
		const target = data.records.find(
			(record) =>
				record.type === "835 Unmatched" && record.owner && record.status,
		);
		expect(target).toBeDefined();
		if (!target?.owner || !target.status) return;
		fireEvent.change(
			await screen.findByRole("searchbox", { name: /Search exception ID/ }),
			{
				target: { value: target.exceptionId.toLowerCase() },
			},
		);
		fireEvent.change(screen.getByRole("combobox", { name: "Status" }), {
			target: { value: target.status },
		});
		fireEvent.change(screen.getByRole("combobox", { name: "Exception Type" }), {
			target: { value: "835 Unmatched" },
		});
		fireEvent.change(screen.getByRole("combobox", { name: "Owner" }), {
			target: { value: target.owner },
		});
		expect(screen.getByText("Showing 1–1 of 1 exceptions")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: /Clear filters/ }));
		const table = screen.getByRole("region", {
			name: "Exception work queue results",
		});
		fireEvent.click(
			within(table).getByRole("button", { name: "Exception ID" }),
		);
		expect(
			within(table).getByRole("columnheader", { name: "Exception ID" }),
		).toHaveAttribute("aria-sort", "ascending");
		fireEvent.click(screen.getByRole("button", { name: "Next" }));
		expect(
			screen.getByText("Showing 26–50 of 180 exceptions"),
		).toBeInTheDocument();
		expect(screen.getByText("Page 2 of 8")).toBeInTheDocument();
	});

	it("opens details and navigates through supported related record IDs", async () => {
		const data = await loadExceptions();
		const onOpenClaim = vi.fn();
		const onOpenPayment = vi.fn();
		const onOpenDenial = vi.fn();
		const onOpenAr = vi.fn();
		const { unmount } = render(
			<ExceptionsPage
				onOpenClaim={onOpenClaim}
				onOpenPayment={onOpenPayment}
				onOpenDenial={onOpenDenial}
				onOpenAr={onOpenAr}
				loadData={() => Promise.resolve(data)}
			/>,
		);
		const target = data.records.find(
			(record) => record.type === "835 Unmatched" && record.payments.length,
		);
		expect(target).toBeDefined();
		if (!target?.payments[0]) return;
		fireEvent.change(
			await screen.findByRole("searchbox", { name: /Search exception ID/ }),
			{
				target: { value: target.exceptionId },
			},
		);
		fireEvent.click(
			screen.getByRole("button", {
				name: `Open exception ${target.exceptionId}`,
			}),
		);
		await screen.findByRole("heading", { name: "Exception Detail" });
		expect(
			screen.getByRole("region", {
				name: "Linked unmatched 835 payments",
			}),
		).toHaveTextContent(target.payments[0].paymentId);
		fireEvent.click(
			screen.getByRole("button", {
				name: `Open payment ${target.payments[0].paymentId}`,
			}),
		);
		expect(onOpenPayment).toHaveBeenCalledWith(target.payments[0].paymentId);
		fireEvent.click(screen.getByRole("button", { name: "Open Claim Detail" }));
		expect(onOpenClaim).toHaveBeenCalledWith(target.claimId);
		unmount();

		const aged = data.records.find(
			(record) => record.type === "High AR Aging" && record.arRecords.length,
		);
		expect(aged?.arRecords[0]).toBeDefined();
		if (!aged?.arRecords[0]) return;
		const arView = render(
			<ExceptionsPage
				onOpenClaim={onOpenClaim}
				onOpenPayment={onOpenPayment}
				onOpenDenial={onOpenDenial}
				onOpenAr={onOpenAr}
				loadData={() => Promise.resolve(data)}
			/>,
		);
		fireEvent.change(
			await screen.findByRole("searchbox", { name: /Search exception ID/ }),
			{
				target: { value: aged.exceptionId },
			},
		);
		fireEvent.click(
			screen.getByRole("button", {
				name: `Open exception ${aged.exceptionId}`,
			}),
		);
		await screen.findByRole("heading", { name: "Exception Detail" });
		fireEvent.click(
			screen.getByRole("button", { name: `Open AR ${aged.arRecords[0].arId}` }),
		);
		expect(onOpenAr).toHaveBeenCalledWith(aged.arRecords[0].arId);
		arView.unmount();

		const withDenial = data.records.find((record) => record.denials.length);
		expect(withDenial?.denials[0]).toBeDefined();
		if (!withDenial?.denials[0]) return;
		const denialView = render(
			<ExceptionsPage
				onOpenClaim={onOpenClaim}
				onOpenPayment={onOpenPayment}
				onOpenDenial={onOpenDenial}
				onOpenAr={onOpenAr}
				loadData={() => Promise.resolve(data)}
			/>,
		);
		fireEvent.change(
			await screen.findByRole("searchbox", { name: /Search exception ID/ }),
			{
				target: { value: withDenial.exceptionId },
			},
		);
		fireEvent.click(
			screen.getByRole("button", {
				name: `Open exception ${withDenial.exceptionId}`,
			}),
		);
		await screen.findByRole("heading", { name: "Exception Detail" });
		fireEvent.click(
			screen.getByRole("button", {
				name: `Open denial ${withDenial.denials[0].denialId}`,
			}),
		);
		expect(onOpenDenial).toHaveBeenCalledWith(withDenial.denials[0].denialId);
		denialView.unmount();
	});

	it("renders empty data and reports load failures with retry", async () => {
		const empty: ExceptionsData = {
			records: [],
			summary: {
				totalRecords: 0,
				unresolvedRecords: 0,
				criticalUnresolved: 0,
				highUnresolved: 0,
				linkedClaimCount: 0,
			},
			typeGroups: [],
		};
		const loadData = vi
			.fn<() => Promise<ExceptionsData>>()
			.mockResolvedValueOnce(empty)
			.mockRejectedValueOnce(new Error("Exceptions source unavailable"))
			.mockResolvedValueOnce(await loadExceptions());
		const props = {
			onOpenClaim: noop,
			onOpenPayment: noop,
			onOpenDenial: noop,
			onOpenAr: noop,
			loadData,
		};
		const { rerender } = render(<ExceptionsPage {...props} />);
		expect(
			await screen.findByText("No exception records found"),
		).toBeInTheDocument();
		rerender(<ExceptionsPage {...props} loadData={() => loadData()} />);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Exceptions source unavailable",
		);
		fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(
			await screen.findByRole("heading", { name: "Exceptions" }),
		).toBeInTheDocument();
	});
});
