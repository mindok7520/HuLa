<template>
  <div class="relative size-full">
    <!-- 지도 컨테이너 -->
    <TlbsMap
      ref="mapRef"
      :api-key="apiKey"
      :center="mapCenter"
      :zoom="zoom"
      :map-type-id="'vector'"
      :control="mapControl"
      :options="mapOptions"
      :style="{ height: `${height}px` }"
      @map_inited="() => emit('map-ready')">
      <!-- 위치 마커 -->
      <TlbsMultiMarker
        id="location-marker"
        :styles="markerStyles"
        :geometries="markerGeometries"
        @click="props.draggable ? handleMarkerClick : undefined"
        @dragend="props.draggable ? handleMarkerDragEnd : undefined" />
    </TlbsMap>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
type LocationData = {
  latitude: number
  longitude: number
  address?: string
  timestamp: number
}

type LocationMapProps = {
  location: LocationData
  apiKey: string
  zoom?: number
  height?: number
  draggable?: boolean
}

type LocationMapEmits = {
  'location-change': [location: { lat: number; lng: number }]
  'map-ready': []
  'map-error': [error: string]
}

const props = withDefaults(defineProps<LocationMapProps>(), {
  zoom: 15,
  height: 300,
  draggable: true
})

const emit = defineEmits<LocationMapEmits>()
const { t } = useI18n()

// 지도 인스턴스 및 상태
const mapRef = ref()

// 계산된 속성
const mapCenter = computed(() => ({
  lat: props.location.latitude,
  lng: props.location.longitude
}))

// 지도 설정
const mapControl = {
  scale: true,
  zoom: false,
  mapType: false,
  rotation: false // 나침반 비활성화
}

// 지도 상호작용 옵션 - draggable 속성에 따라 상호작용 여부 결정
const mapOptions = computed(() => ({
  draggable: props.draggable, // 드래그 설정
  scrollWheelZoom: props.draggable, // 휠 스크롤 확대/축소 설정
  doubleClickZoom: props.draggable, // 더블 클릭 확대/축소 설정
  clickable: props.draggable // 클릭 설정
}))

const markerStyles = {
  'current-location': {
    width: 25,
    height: 35,
    anchor: { x: 12, y: 35 },
    color: '#FF4444'
  }
}

const markerGeometries = computed(() => [
  {
    id: 'current',
    styleId: 'current-location',
    position: mapCenter.value,
    properties: { title: t('message.location.map.marker_current') },
    draggable: props.draggable
  }
])

// 이벤트 처리
const handleMarkerClick = (event: any) => {
  if (props.draggable) {
    emit('location-change', {
      lat: event.latLng.lat,
      lng: event.latLng.lng
    })
  }
}

const handleMarkerDragEnd = (event: any) => {
  if (props.draggable) {
    emit('location-change', {
      lat: event.geometry.position.lat,
      lng: event.geometry.position.lng
    })
  }
}

// 반응형 데이터 감시
watch(
  () => props.location,
  (newLocation) => {
    if (mapRef.value?.map && newLocation) {
      mapRef.value.map.setCenter({
        lat: newLocation.latitude,
        lng: newLocation.longitude
      })
    }
  },
  { deep: true }
)

watch(
  () => props.zoom,
  (newZoom) => {
    if (mapRef.value?.map) {
      mapRef.value.map.setZoom(newZoom)
    }
  }
)
</script>

<style scoped lang="scss"></style>
