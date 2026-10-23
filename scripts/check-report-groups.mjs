// node --experimental-strip-types scripts/check-report-groups.mjs
// The database check is supabase/tests/report_cost_group.sql.
import { assertReportGroupChecks } from "../src/lib/report-cost-group.ts"

assertReportGroupChecks()
console.log("Report group checks passed.")
