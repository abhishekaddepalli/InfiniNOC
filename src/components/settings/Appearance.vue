<template>
    <div>
        <div class="my-4">
            <label for="language" class="form-label">
                {{ $t("Language") }}
            </label>
            <select id="language" v-model="$root.language" class="form-select">
                <option v-for="(lang, i) in $i18n.availableLocales" :key="`Lang${i}`" :value="lang">
                    {{ $i18n.messages[lang].languageName }}
                </option>
            </select>
        </div>

        <div class="my-4">
            <label class="form-label fw-bold">Appearance Theme</label>
            <div class="row g-3 mt-1">
                <div class="col-md-4">
                    <div
                        class="theme-card p-3 text-center rounded-3 cursor-pointer"
                        :class="{ active: $root.userTheme === 'light' }"
                        @click="$root.userTheme = 'light'"
                    >
                        <div class="fs-2 mb-2">☀</div>
                        <div class="fw-bold mb-1">Light</div>
                        <div class="text-muted small">Always use the light appearance.</div>
                    </div>
                </div>

                <div class="col-md-4">
                    <div
                        class="theme-card p-3 text-center rounded-3 cursor-pointer"
                        :class="{ active: $root.userTheme === 'dark' }"
                        @click="$root.userTheme = 'dark'"
                    >
                        <div class="fs-2 mb-2">🌙</div>
                        <div class="fw-bold mb-1">Dark</div>
                        <div class="text-muted small">Always use the dark appearance.</div>
                    </div>
                </div>

                <div class="col-md-4">
                    <div
                        class="theme-card p-3 text-center rounded-3 cursor-pointer"
                        :class="{ active: $root.userTheme === 'auto' }"
                        @click="$root.userTheme = 'auto'"
                    >
                        <div class="fs-2 mb-2">🖥</div>
                        <div class="fw-bold mb-1">Auto</div>
                        <div class="text-muted small">Follow your device appearance preference.</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="my-4">
            <label class="form-label">{{ $t("Theme - Heartbeat Bar") }}</label>
            <div>
                <div class="btn-group" role="group" :aria-label="$t('Basic checkbox toggle button group')">
                    <input
                        id="btncheck4"
                        v-model="$root.userHeartbeatBar"
                        type="radio"
                        class="btn-check"
                        name="heartbeatBarTheme"
                        autocomplete="off"
                        value="normal"
                    />
                    <label class="btn btn-outline-primary" for="btncheck4">
                        {{ $t("Normal") }}
                    </label>

                    <input
                        id="btncheck5"
                        v-model="$root.userHeartbeatBar"
                        type="radio"
                        class="btn-check"
                        name="heartbeatBarTheme"
                        autocomplete="off"
                        value="bottom"
                    />
                    <label class="btn btn-outline-primary" for="btncheck5">
                        {{ $t("Bottom") }}
                    </label>

                    <input
                        id="btncheck6"
                        v-model="$root.userHeartbeatBar"
                        type="radio"
                        class="btn-check"
                        name="heartbeatBarTheme"
                        autocomplete="off"
                        value="none"
                    />
                    <label class="btn btn-outline-primary" for="btncheck6">
                        {{ $t("None") }}
                    </label>
                </div>
            </div>
        </div>

        <!-- Timeline -->
        <div class="my-4">
            <label class="form-label">{{ $t("styleElapsedTime") }}</label>
            <div>
                <div class="btn-group" role="group">
                    <input
                        id="styleElapsedTimeShowNoLine"
                        v-model="$root.styleElapsedTime"
                        type="radio"
                        class="btn-check"
                        name="styleElapsedTime"
                        autocomplete="off"
                        value="no-line"
                    />
                    <label class="btn btn-outline-primary" for="styleElapsedTimeShowNoLine">
                        {{ $t("styleElapsedTimeShowNoLine") }}
                    </label>

                    <input
                        id="styleElapsedTimeShowWithLine"
                        v-model="$root.styleElapsedTime"
                        type="radio"
                        class="btn-check"
                        name="styleElapsedTime"
                        autocomplete="off"
                        value="with-line"
                    />
                    <label class="btn btn-outline-primary" for="styleElapsedTimeShowWithLine">
                        {{ $t("styleElapsedTimeShowWithLine") }}
                    </label>

                    <input
                        id="styleElapsedTimeNone"
                        v-model="$root.styleElapsedTime"
                        type="radio"
                        class="btn-check"
                        name="styleElapsedTime"
                        autocomplete="off"
                        value="none"
                    />
                    <label class="btn btn-outline-primary" for="styleElapsedTimeNone">
                        {{ $t("None") }}
                    </label>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {};
</script>

<style lang="scss" scoped>
.theme-card {
    border: 2px solid var(--border);
    background-color: var(--card);
    color: var(--foreground);
    transition: all 0.2s ease-in-out;
    cursor: pointer;

    &:hover {
        border-color: var(--accent);
        transform: translateY(-2px);
    }

    &.active {
        border-color: var(--accent);
        background-color: var(--secondary);
        box-shadow: 0 0 15px rgba(255, 153, 51, 0.25);
    }
}
</style>
