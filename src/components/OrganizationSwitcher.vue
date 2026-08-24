<template>
    <div class="dropdown me-2">
        <button
            class="btn btn-sm dropdown-toggle d-flex align-items-center gap-2 noc-org-btn"
            type="button"
            data-bs-toggle="dropdown"
            aria-expanded="false"
        >
            <font-awesome-icon icon="building" class="text-warning" />
            <span class="fw-bold text-truncate" style="max-width: 150px; color: var(--foreground);">
                {{ activeOrgName }}
            </span>
            <span v-if="activeOrgRole" class="badge noc-role-badge text-uppercase">
                {{ activeOrgRole }}
            </span>
        </button>

        <ul class="dropdown-menu dropdown-menu-end p-2 shadow-lg noc-org-dropdown">
            <li class="dropdown-header text-uppercase small px-2 py-1 fw-bold text-warning" style="letter-spacing: 0.05em;">
                {{ $t("Organizations") }}
            </li>
            
            <li v-for="org in $root.organizationList" :key="org.id">
                <button
                    class="dropdown-item d-flex justify-content-between align-items-center rounded py-2 px-2"
                    :class="{ active: org.id === $root.activeOrganizationId }"
                    @click="switchOrg(org.id)"
                >
                    <div class="d-flex align-items-center gap-2">
                        <font-awesome-icon
                            :icon="org.id === $root.activeOrganizationId ? 'check-circle' : 'building'"
                            :class="org.id === $root.activeOrganizationId ? 'text-warning' : 'text-secondary'"
                        />
                        <span class="fw-semibold">{{ org.name }}</span>
                    </div>
                    <span class="badge bg-secondary text-uppercase" style="font-size: 0.6rem; opacity: 0.85;">
                        {{ org.role }}
                    </span>
                </button>
            </li>

            <li><hr class="dropdown-divider my-2" style="border-color: var(--border);" /></li>

            <li>
                <button
                    class="dropdown-item d-flex align-items-center gap-2 py-2 px-2 text-warning rounded fw-semibold"
                    @click="openModal"
                >
                    <font-awesome-icon icon="plus-circle" />
                    <span>Create Organization</span>
                </button>
            </li>
        </ul>

        <!-- Create Organization Modal -->
        <div v-if="showCreateModal" class="modal d-block noc-modal-backdrop" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content noc-modal-content">
                    <div class="modal-header border-bottom border-secondary px-4 py-3">
                        <h5 class="modal-title fw-bold text-warning d-flex align-items-center gap-2">
                            <font-awesome-icon icon="building" />
                            <span>Create New Organization</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" @click="showCreateModal = false"></button>
                    </div>
                    <div class="modal-body px-4 py-3">
                        <div class="mb-3">
                            <label class="form-label fw-semibold small text-uppercase" style="letter-spacing: 0.03em;">Organization Name</label>
                            <input
                                ref="nameInput"
                                v-model="newOrgName"
                                type="text"
                                class="form-control noc-input"
                                placeholder="e.g. NOC Engineering East"
                                @input="generateSlug"
                                @keyup.enter="createOrg"
                            />
                        </div>
                        <div class="mb-3">
                            <label class="form-label fw-semibold small text-uppercase" style="letter-spacing: 0.03em;">Organization Slug</label>
                            <input
                                v-model="newOrgSlug"
                                type="text"
                                class="form-control noc-input"
                                placeholder="e.g. noc-eng-east"
                                @keyup.enter="createOrg"
                            />
                        </div>
                    </div>
                    <div class="modal-footer border-top border-secondary px-4 py-3">
                        <button type="button" class="btn btn-outline-secondary px-3" @click="showCreateModal = false">
                            Cancel
                        </button>
                        <button
                            type="button"
                            class="btn noc-submit-btn px-4 fw-bold"
                            :disabled="!newOrgName || !newOrgSlug || submitting"
                            @click="createOrg"
                        >
                            <span v-if="submitting" class="spinner-border spinner-border-sm me-2" role="status"></span>
                            Create
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            showCreateModal: false,
            newOrgName: "",
            newOrgSlug: "",
            submitting: false,
        };
    },
    computed: {
        activeOrgObj() {
            return this.$root.organizationList.find((o) => o.id === this.$root.activeOrganizationId);
        },
        activeOrgName() {
            return this.activeOrgObj ? this.activeOrgObj.name : "Default Organization";
        },
        activeOrgRole() {
            return this.activeOrgObj ? this.activeOrgObj.role : "";
        },
    },
    methods: {
        switchOrg(orgId) {
            if (orgId !== this.$root.activeOrganizationId) {
                this.$root.getSocket().emit("switchOrganization", orgId, (res) => {
                    if (res && res.ok) {
                        this.$root.activeOrganizationId = orgId;
                        this.$root.toastSuccess("Switched organization context");
                        window.location.reload();
                    } else {
                        this.$root.toastError(res ? res.msg : "Failed to switch organization");
                    }
                });
            }
        },
        openModal() {
            this.newOrgName = "";
            this.newOrgSlug = "";
            this.showCreateModal = true;
            this.$nextTick(() => {
                if (this.$refs.nameInput) {
                    this.$refs.nameInput.focus();
                }
            });
        },
        generateSlug() {
            if (this.newOrgName) {
                this.newOrgSlug = this.newOrgName
                    .toLowerCase()
                    .trim()
                    .replace(/[^a-z0-9\s-]/g, "")
                    .replace(/\s+/g, "-");
            }
        },
        createOrg() {
            if (!this.newOrgName || !this.newOrgSlug) {
                return;
            }
            this.submitting = true;
            this.$root.getSocket().emit("createOrganization", { name: this.newOrgName, slug: this.newOrgSlug }, (res) => {
                this.submitting = false;
                if (res && res.ok) {
                    this.$root.toastSuccess(`Organization '${this.newOrgName}' created`);
                    this.showCreateModal = false;
                    this.$root.activeOrganizationId = res.organization.id;
                    window.location.reload();
                } else {
                    this.$root.toastError(res ? res.msg : "Failed to create organization");
                }
            });
        },
    },
};
</script>

<style scoped>
.noc-org-btn {
    background-color: var(--secondary);
    border: 1px solid var(--border);
    color: var(--foreground);
    border-radius: 8px;
    padding: 0.4rem 0.75rem;
    transition: all 0.2s ease-in-out;
}

.noc-org-btn:hover {
    background-color: var(--sidebar-hover);
}

.noc-role-badge {
    background-color: var(--accent);
    color: var(--accent-foreground);
    font-size: 0.65rem;
    letter-spacing: 0.05em;
    padding: 0.25em 0.5em;
}

.noc-org-dropdown {
    min-width: 250px;
    background-color: var(--popover);
    border: 1px solid var(--border);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.dropdown-item {
    color: var(--popover-foreground);
    transition: background-color 0.15s ease-in-out;
}

.dropdown-item.active {
    background-color: var(--accent) !important;
    color: var(--accent-foreground) !important;
}

.dropdown-item:hover:not(.active) {
    background-color: var(--secondary);
    color: var(--foreground);
}

.noc-modal-content {
    background-color: var(--card);
    color: var(--card-foreground);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
}

.noc-input {
    background-color: var(--input-bg);
    border: 1px solid var(--input-border);
    color: var(--input-text);
    border-radius: 8px;
    padding: 0.65rem 0.85rem;
}

.noc-input:focus {
    background-color: var(--input-bg);
    border-color: var(--ring);
    color: var(--input-text);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.noc-submit-btn {
    background-color: var(--accent);
    border-color: var(--accent);
    color: var(--accent-foreground);
    transition: all 0.2s ease-in-out;
}

.noc-submit-btn:disabled {
    opacity: 0.65;
}
</style>
