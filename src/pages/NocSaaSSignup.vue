<template>
    <div class="saas-signup-page min-vh-100 bg-dark text-white d-flex align-items-center justify-content-center p-3">
        <div class="card bg-card border-secondary shadow-lg p-4 text-foreground" style="max-width: 460px; width: 100%;">
            <div class="text-center mb-4">
                <router-link to="/" class="d-inline-flex align-items-center gap-2 text-decoration-none mb-2">
                    <object width="40" height="40" data="/icon.svg" />
                    <span class="fw-bold text-primary fs-3">InfiniNOC</span>
                </router-link>
                <h4 class="fw-bold text-foreground">Start Your 14-Day Free Trial</h4>
                <div class="text-muted small">No credit card required. Full access to NOC monitoring suite.</div>
            </div>

            <form @submit.prevent="handleSignup">
                <div class="mb-3">
                    <label class="form-label small fw-semibold text-muted text-uppercase">Organization Name</label>
                    <input v-model="form.orgName" type="text" class="form-control bg-card border-secondary text-foreground" placeholder="e.g. Apex Telecom ISP" required @input="generateSlug" />
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-semibold text-muted text-uppercase">Admin Username</label>
                    <input v-model="form.username" type="text" class="form-control bg-card border-secondary text-foreground" placeholder="admin_user" required />
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-semibold text-muted text-uppercase">Email Address</label>
                    <input v-model="form.email" type="email" class="form-control bg-card border-secondary text-foreground" placeholder="admin@company.com" required />
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-semibold text-muted text-uppercase">Password</label>
                    <input v-model="form.password" type="password" class="form-control bg-card border-secondary text-foreground" placeholder="••••••••••••" required />
                </div>

                <button type="submit" class="btn btn-warning btn-lg w-100 fw-bold mt-2 py-2" :disabled="loading">
                    <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                    <span>Create Organization Account</span>
                </button>
            </form>

            <div class="text-center mt-4 small text-muted">
                Already have an account? <router-link to="/login" class="text-primary fw-semibold">Login here</router-link>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            form: {
                orgName: "",
                slug: "",
                username: "",
                email: "",
                password: "",
            },
            loading: false,
        };
    },
    methods: {
        generateSlug() {
            this.form.slug = this.form.orgName
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, "-")
                .replace(/-+/g, "-");
        },
        handleSignup() {
            this.loading = true;
            this.$root.getSocket().emit("createOrganization", {
                name: this.form.orgName,
                slug: this.form.slug,
                username: this.form.username,
                email: this.form.email,
                password: this.form.password,
            }, (res) => {
                this.loading = false;
                if (res && res.ok) {
                    this.$root.toastSuccess("Organization account created successfully.");
                    window.location.href = "/dashboard";
                } else {
                    this.$root.toastError((res && res.msg) || "Failed to create organization account.");
                }
            });
        },
    },
};
</script>
