<template>
    <div class="super-admin-invoices">
        <!-- Control Header -->
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 border-bottom border-secondary pb-3">
            <div>
                <h3 class="fw-bold text-foreground mb-1 d-flex align-items-center gap-2">
                    <font-awesome-icon icon="file-invoice-dollar" class="text-warning" />
                    <span>Invoices & Indian GST Compliance</span>
                </h3>
                <div class="text-muted small">
                    Manage tenant B2B invoices with 18% GST (CGST/SGST/IGST), HSN/SAC Code 998313, and INR (₹) amounts.
                </div>
            </div>
            <button class="btn btn-outline-secondary btn-sm fw-bold" @click="fetchInvoices">
                <font-awesome-icon icon="sync" class="me-1" />
                Refresh Invoices
            </button>
        </div>

        <!-- Tax Summary Card -->
        <div class="row g-3 mb-4">
            <div class="col-12 col-md-3">
                <div class="card bg-card border-secondary shadow-sm p-3 border-start border-4 border-warning">
                    <div class="text-muted small text-uppercase fw-semibold mb-1">Total Invoices Issued</div>
                    <div class="fw-bold fs-3 text-foreground font-monospace">{{ invoices.length }}</div>
                </div>
            </div>
            <div class="col-12 col-md-3">
                <div class="card bg-card border-secondary shadow-sm p-3 border-start border-4 border-success">
                    <div class="text-muted small text-uppercase fw-semibold mb-1">Total GST Billed</div>
                    <div class="fw-bold fs-3 text-success font-monospace">₹{{ calculateTotalGst().toLocaleString('en-IN') }}</div>
                </div>
            </div>
            <div class="col-12 col-md-3">
                <div class="card bg-card border-secondary shadow-sm p-3 border-start border-4 border-info">
                    <div class="text-muted small text-uppercase fw-semibold mb-1">HSN / SAC Code</div>
                    <div class="fw-bold fs-3 text-info font-monospace">998313</div>
                </div>
            </div>
            <div class="col-12 col-md-3">
                <div class="card bg-card border-secondary shadow-sm p-3 border-start border-4 border-primary">
                    <div class="text-muted small text-uppercase fw-semibold mb-1">GST Tax Rate</div>
                    <div class="fw-bold fs-3 text-primary font-monospace">18.00%</div>
                </div>
            </div>
        </div>

        <!-- Invoices Table -->
        <div class="card bg-card border-secondary shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom border-secondary py-3 px-4 d-flex justify-content-between align-items-center">
                <h6 class="fw-bold mb-0 text-foreground text-uppercase">B2B Tax Invoices</h6>
                <span class="badge bg-secondary font-monospace">GST Compliance Enabled</span>
            </div>
            <div class="card-body p-0">
                <div v-if="loading" class="text-center py-5 text-muted">
                    <div class="spinner-border text-primary me-2" role="status"></div>
                    <span>Loading invoices...</span>
                </div>

                <div v-else-if="invoices.length > 0" class="table-responsive">
                    <table class="table table-hover align-middle mb-0 font-monospace">
                        <thead class="table-dark">
                            <tr>
                                <th>INVOICE #</th>
                                <th>ORGANIZATION</th>
                                <th>GSTIN</th>
                                <th>SUBTOTAL</th>
                                <th>CGST (9%)</th>
                                <th>SGST (9%)</th>
                                <th>TOTAL (₹)</th>
                                <th>STATUS</th>
                                <th>DATE</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="inv in invoices" :key="inv.id">
                                <td class="fw-bold text-primary">{{ inv.invoice_number }}</td>
                                <td>{{ inv.org_name || 'Organization' }}</td>
                                <td class="text-muted small">{{ inv.gstin || '33AAAAA0000A1Z5' }}</td>
                                <td>₹{{ (inv.subtotal || 0).toLocaleString('en-IN') }}</td>
                                <td class="text-success">₹{{ (inv.cgst || 0).toLocaleString('en-IN') }}</td>
                                <td class="text-success">₹{{ (inv.sgst || 0).toLocaleString('en-IN') }}</td>
                                <td class="fw-bold text-warning">₹{{ (inv.total || 0).toLocaleString('en-IN') }}</td>
                                <td>
                                    <span class="badge bg-success text-uppercase">{{ inv.status || 'paid' }}</span>
                                </td>
                                <td class="text-muted small">{{ inv.created_at || 'N/A' }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div v-else class="text-center py-5 text-muted small">
                    No tax invoices generated yet.
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            invoices: [],
            loading: true,
        };
    },
    mounted() {
        this.fetchInvoices();
    },
    methods: {
        fetchInvoices() {
            this.loading = true;
            this.$root.getSocket().emit("getSuperAdminInvoices", (res) => {
                this.loading = false;
                if (res && res.ok) {
                    this.invoices = res.invoices || [];
                }
            });
        },
        calculateTotalGst() {
            return this.invoices.reduce((sum, i) => sum + (i.cgst || 0) + (i.sgst || 0) + (i.igst || 0), 0);
        },
    },
};
</script>

<style scoped>
.font-monospace {
    font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
