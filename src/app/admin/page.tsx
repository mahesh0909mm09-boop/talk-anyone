
"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createBrowserClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

const ADMIN_ID = "10045838-10e6-4136-b3c6-eba8725f5e4a";

type ReportStatus = "pending" | "reviewed";

type Report = {
  id: string;
  reporter_socket_id: string;
  reported_socket_id: string;
  reason: string;
  status: string;
  review_note: string | null;
  created_at: string;
};

export default function AdminPage() {
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) return null;

    return createBrowserClient(url, key);
  }, []);

  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(
    null
  );

  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const signedInUserId = user?.id;
  const isAdmin = signedInUserId === ADMIN_ID;

  // Check the current login session
  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }

    let active = true;

    void supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!active) return;

        setUser(error ? null : data.user);
        setReady(true);
      })
      .catch(() => {
        if (active) {
          setUser(null);
          setReady(true);
        }
      });

    const { data: listener } =
      supabase.auth.onAuthStateChange((_event, session) => {
        if (!active) return;

        setUser(session?.user ?? null);
        setReady(true);
      });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  // Fetch reports from Supabase
  const loadReports = useCallback(async () => {
    if (!supabase || signedInUserId !== ADMIN_ID) return;

    setLoadingReports(true);
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("reports")
        .select(
          "id, reporter_socket_id, reported_socket_id, reason, status, review_note, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      setReports((data ?? []) as Report[]);
      setNoteDrafts(
        Object.fromEntries(
          (data ?? []).map((report) => [
            report.id,
            report.review_note ?? "",
          ])
        )
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load reports."
      );
    } finally {
      setLoadingReports(false);
    }
  }, [supabase, signedInUserId]);

  // Automatically load reports for authorized admin
  useEffect(() => {
    if (!ready) return;

    if (isAdmin) {
      void loadReports();
    } else {
      setReports([]);
    }
  }, [ready, isAdmin, loadReports]);

  // Login
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setMessage("Supabase configuration is missing.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error) throw error;

      setUser(data.user);
      setPassword("");
      setMessage("Login successful.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Login failed."
      );
    } finally {
      setBusy(false);
    }
  }

  // Logout
  async function logout() {
    if (!supabase) return;

    setBusy(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(error.message);
    } else {
      setUser(null);
      setReports([]);
      setMessage("Logged out successfully.");
    }

    setBusy(false);
  }

  // Mark a report as Reviewed or Pending
  async function updateReportStatus(
    reportId: string,
    nextStatus: ReportStatus
  ) {
    if (!supabase || !isAdmin || updatingId) return;

    setUpdatingId(reportId);
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("reports")
        .update({ status: nextStatus })
        .eq("id", reportId)
        .select("id, status")
        .single();

      if (error) throw error;

      if (!data) {
        throw new Error("The report could not be updated.");
      }

      setReports((previous) =>
        previous.map((report) =>
          report.id === reportId
            ? { ...report, status: data.status }
            : report
        )
      );

      setMessage(
        nextStatus === "reviewed"
          ? "Report marked as Reviewed successfully."
          : "Report marked as Pending successfully."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not update report."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function saveReviewNote(reportId: string) {
    if (!supabase || !isAdmin || updatingId) return;

    const note = (noteDrafts[reportId] ?? "").trim();

    setUpdatingId(reportId);
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("reports")
        .update({ review_note: note || null })
        .eq("id", reportId)
        .select("id, review_note")
        .single();

      if (error) throw error;

      setReports((previous) =>
        previous.map((report) =>
          report.id === reportId
            ? { ...report, review_note: data.review_note }
            : report
        )
      );

      setNoteDrafts((previous) => ({
        ...previous,
        [reportId]: data.review_note ?? "",
      }));

      setMessage("Review note saved to Supabase.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save review note."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  const pendingCount = reports.filter(
    (report) => report.status === "pending"
  ).length;

  const reviewedCount = reports.filter(
    (report) => report.status === "reviewed"
  ).length;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-cyan-400">
              TALK ANYONE
            </h1>
            <p className="mt-1 text-slate-400">
              Admin Dashboard
            </p>
          </div>

          <a
            href="/"
            className="text-cyan-300 hover:underline"
          >
            Back to Website
          </a>
        </header>

        {!supabase ? (
          <p className="text-red-400">
            Missing Supabase environment variables.
          </p>
        ) : !ready ? (
          <p>Checking login...</p>
        ) : !user ? (
          <div className="mx-auto max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="mb-6 text-2xl font-bold">
              Admin Login
            </h2>

            <form onSubmit={login} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block"
                >
                  Email
                </label>

                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-600 bg-slate-950 p-3"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block"
                >
                  Password
                </label>

                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-600 bg-slate-950 p-3"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-cyan-600 p-3 font-bold hover:bg-cyan-500 disabled:opacity-50"
              >
                {busy ? "Signing in..." : "Login"}
              </button>
            </form>
          </div>
        ) : !isAdmin ? (
          <div className="rounded-xl border border-red-800 bg-slate-900 p-6">
            <h2 className="text-xl font-bold text-red-400">
              Access Denied
            </h2>

            <p className="mt-2 text-slate-300">
              This account is not authorized to view reports.
            </p>

            <button
              onClick={logout}
              disabled={busy}
              className="mt-4 rounded-xl bg-red-600 px-5 py-3"
            >
              Logout
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="break-all text-green-400">
                Admin signed in: {user.email}
              </p>

              <button
                onClick={logout}
                disabled={busy}
                className="rounded-xl bg-red-600 px-5 py-3 font-bold disabled:opacity-50"
              >
                Logout
              </button>
            </div>

            {/* Dashboard statistics */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-900 p-6">
                <p className="text-slate-400">
                  Loaded Reports
                </p>

                <p className="mt-2 text-4xl font-bold text-cyan-400">
                  {reports.length}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-900 p-6">
                <p className="text-slate-400">
                  Pending Reviews
                </p>

                <p className="mt-2 text-4xl font-bold text-yellow-400">
                  {pendingCount}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-900 p-6">
                <p className="text-slate-400">
                  Reviewed Reports
                </p>

                <p className="mt-2 text-4xl font-bold text-green-400">
                  {reviewedCount}
                </p>
              </div>
            </div>

            {/* Reports table */}
            <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold">
                  User Reports
                </h2>

                <button
                  onClick={() => void loadReports()}
                  disabled={loadingReports || updatingId !== null}
                  className="rounded-xl bg-cyan-600 px-5 py-3 font-bold hover:bg-cyan-500 disabled:opacity-50"
                >
                  {loadingReports
                    ? "Loading..."
                    : "Refresh Reports"}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-700 text-slate-300">
                    <tr>
                      <th className="p-3">Reason</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Reported At</th>
                      <th className="p-3">Reported Socket</th>
                      <th className="p-3">Review Note</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {reports.map((report) => (
                      <tr
                        key={report.id}
                        className="border-b border-slate-800"
                      >
                        <td className="p-3 capitalize">
                          {report.reason.replaceAll("-", " ")}
                        </td>

                        <td className="p-3">
                          <span
                            className={
                              report.status === "reviewed"
                                ? "font-semibold text-green-400"
                                : "font-semibold text-yellow-400"
                            }
                          >
                            {report.status}
                          </span>
                        </td>

                        <td className="p-3">
                          {new Date(
                            report.created_at
                          ).toLocaleString()}
                        </td>

                        <td className="p-3 font-mono text-xs">
                          {report.reported_socket_id}
                        </td>

                        <td className="p-3">
                          <textarea
                            aria-label="Review note"
                            rows={2}
                            maxLength={1000}
                            value={noteDrafts[report.id] ?? ""}
                            onChange={(event) =>
                              setNoteDrafts((previous) => ({
                                ...previous,
                                [report.id]: event.target.value,
                              }))
                            }
                            placeholder="Write a review note..."
                            className="min-w-48 rounded-lg border border-slate-600 bg-slate-950 p-2 text-white"
                          />
                          <button
                            onClick={() =>
                              void saveReviewNote(report.id)
                            }
                            disabled={
                              updatingId !== null ||
                              (noteDrafts[report.id] ?? "").trim() ===
                                (report.review_note ?? "")
                            }
                            className="mt-2 block rounded-lg bg-blue-600 px-3 py-2 font-semibold disabled:opacity-40"
                          >
                            {updatingId === report.id
                              ? "Saving..."
                              : "Save Note"}
                          </button>
                        </td>

                        <td className="p-3">
                          {report.status === "pending" ? (
                            <button
                              onClick={() =>
                                void updateReportStatus(
                                  report.id,
                                  "reviewed"
                                )
                              }
                              disabled={updatingId !== null}
                              className="whitespace-nowrap rounded-lg bg-green-600 px-3 py-2 font-semibold hover:bg-green-500 disabled:opacity-50"
                            >
                              {updatingId === report.id
                                ? "Saving..."
                                : "Mark Reviewed"}
                            </button>
                          ) : report.status === "reviewed" ? (
                            <button
                              onClick={() =>
                                void updateReportStatus(
                                  report.id,
                                  "pending"
                                )
                              }
                              disabled={updatingId !== null}
                              className="whitespace-nowrap rounded-lg bg-orange-600 px-3 py-2 font-semibold hover:bg-orange-500 disabled:opacity-50"
                            >
                              {updatingId === report.id
                                ? "Saving..."
                                : "Mark Pending"}
                            </button>
                          ) : (
                            <span className="text-slate-500">
                              No action
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!loadingReports && reports.length === 0 && (
                <p className="mt-5 text-center text-slate-400">
                  No reports found.
                </p>
              )}

              <p className="mt-4 text-xs text-slate-500">
                Showing up to 100 latest reports.
                Counts apply to loaded reports only.
              </p>
            </section>
          </div>
        )}

        {message && (
          <p
            role="status"
            className="mt-5 rounded-xl border border-slate-700 bg-slate-900 p-4 text-center text-sm text-cyan-300"
          >
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
