<template>
    <div class="cidr-calculator-tool">
        <SubnetCalculatorTool :tool="tool" />
    </div>
</template>

<script>
import SubnetCalculatorTool from "./SubnetCalculatorTool.vue";

export default {
    components: {
        SubnetCalculatorTool,
    },
    props: {
        tool: {
            type: Object,
            default: null,
        },
    },
};
</script>
