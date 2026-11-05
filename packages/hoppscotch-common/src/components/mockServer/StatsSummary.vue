<template>
  <div class="mb-4 rounded border border-dividerDark p-3">
    <div class="mb-3 flex items-center justify-between">
      <span class="font-semibold text-secondaryDark">
        {{ t("mock_server.stats_title", { days: STATS_WINDOW_DAYS }) }}
      </span>
      <HoppSmartSpinner v-if="loading" />
    </div>

    <div v-if="stats" class="flex flex-col space-y-3">
      <div class="grid grid-cols-3 gap-2">
        <div class="flex flex-col rounded bg-primaryLight px-3 py-2">
          <span class="text-tiny text-secondaryLight">
            {{ t("mock_server.stats_requests") }}
          </span>
          <span class="text-lg font-semibold text-secondaryDark">
            {{ stats.hitCount }}
          </span>
        </div>
        <div class="flex flex-col rounded bg-primaryLight px-3 py-2">
          <span class="text-tiny text-secondaryLight">
            {{ t("mock_server.stats_errors") }}
          </span>
          <span
            class="text-lg font-semibold"
            :class="
              stats.errorCount > 0 ? 'text-red-400' : 'text-secondaryDark'
            "
          >
            {{ stats.errorCount }}
            <span
              v-if="stats.hitCount > 0"
              class="text-tiny font-normal text-secondaryLight"
            >
              ({{ errorRate }}%)
            </span>
          </span>
        </div>
        <div class="flex flex-col rounded bg-primaryLight px-3 py-2">
          <span class="text-tiny text-secondaryLight">
            {{ t("mock_server.stats_avg_response_time") }}
          </span>
          <span class="text-lg font-semibold text-secondaryDark">
            {{ stats.avgResponseTimeMs }} ms
          </span>
        </div>
      </div>

      <div class="flex h-12 items-end space-x-1">
        <div
          v-for="day in stats.daily"
          :key="day.date"
          v-tippy="{ theme: 'tooltip' }"
          :title="
            t('mock_server.stats_day_tooltip', {
              date: day.date,
              requests: day.hitCount,
              errors: day.errorCount,
            })
          "
          class="flex h-full flex-1 flex-col justify-end"
        >
          <div
            class="w-full rounded-t-sm bg-accent/70"
            :style="{ height: barHeight(day.hitCount) }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import * as TE from "fp-ts/TaskEither"
import { pipe } from "fp-ts/function"
import { useI18n } from "~/composables/i18n"
import { useToast } from "~/composables/toast"
import { platform } from "~/platform"
import { GetMockServerStatsQuery } from "~/helpers/backend/graphql"

const STATS_WINDOW_DAYS = 7

const props = defineProps<{ mockServerID: string }>()

const t = useI18n()
const toast = useToast()

const loading = ref(false)
const stats = ref<GetMockServerStatsQuery["mockServerStats"] | null>(null)

const errorRate = computed(() => {
  if (!stats.value || stats.value.hitCount === 0) return 0
  return Math.round((stats.value.errorCount / stats.value.hitCount) * 100)
})

const maxDailyHits = computed(() =>
  Math.max(0, ...(stats.value?.daily.map((day) => day.hitCount) ?? []))
)

// Keep a sliver visible for empty days so the timeline stays readable
const barHeight = (hitCount: number) => {
  if (maxDailyHits.value === 0 || hitCount === 0) return "2px"
  return `${Math.max(8, Math.round((hitCount / maxDailyHits.value) * 100))}%`
}

const fetchStats = async () => {
  loading.value = true
  await pipe(
    platform.backend.getMockServerStats(props.mockServerID, STATS_WINDOW_DAYS),
    TE.match(
      () => {
        toast.error(t("mock_server.stats_fetch_failed"))
      },
      (res) => {
        stats.value = res
      }
    )
  )()
  loading.value = false
}

onMounted(fetchStats)
</script>
