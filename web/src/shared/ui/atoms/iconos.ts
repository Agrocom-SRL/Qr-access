/* Material Symbols Outlined (peso 400), uno por uno para que el build solo incluya los usados. */
import space_dashboard from '@material-symbols/svg-400/outlined/space_dashboard.svg?raw';
import apartment from '@material-symbols/svg-400/outlined/apartment.svg?raw';
import payments from '@material-symbols/svg-400/outlined/payments.svg?raw';
import sell from '@material-symbols/svg-400/outlined/sell.svg?raw';
import history from '@material-symbols/svg-400/outlined/history.svg?raw';
import group from '@material-symbols/svg-400/outlined/group.svg?raw';
import visibility from '@material-symbols/svg-400/outlined/visibility.svg?raw';
import visibility_off from '@material-symbols/svg-400/outlined/visibility_off.svg?raw';
import edit from '@material-symbols/svg-400/outlined/edit.svg?raw';
import autorenew from '@material-symbols/svg-400/outlined/autorenew.svg?raw';
import swap_vert from '@material-symbols/svg-400/outlined/swap_vert.svg?raw';
import pause_circle from '@material-symbols/svg-400/outlined/pause_circle.svg?raw';
import receipt_long from '@material-symbols/svg-400/outlined/receipt_long.svg?raw';
import all_inclusive from '@material-symbols/svg-400/outlined/all_inclusive.svg?raw';
import add from '@material-symbols/svg-400/outlined/add.svg?raw';
import search from '@material-symbols/svg-400/outlined/search.svg?raw';
import check_circle from '@material-symbols/svg-400/outlined/check_circle.svg?raw';
import schedule from '@material-symbols/svg-400/outlined/schedule.svg?raw';
import event_busy from '@material-symbols/svg-400/outlined/event_busy.svg?raw';
import error from '@material-symbols/svg-400/outlined/error.svg?raw';
import chevron_left from '@material-symbols/svg-400/outlined/chevron_left.svg?raw';
import chevron_right from '@material-symbols/svg-400/outlined/chevron_right.svg?raw';
import check from '@material-symbols/svg-400/outlined/check.svg?raw';
import content_copy from '@material-symbols/svg-400/outlined/content_copy.svg?raw';
import close from '@material-symbols/svg-400/outlined/close.svg?raw';
import arrow_back from '@material-symbols/svg-400/outlined/arrow_back.svg?raw';
import arrow_forward from '@material-symbols/svg-400/outlined/arrow_forward.svg?raw';
import info from '@material-symbols/svg-400/outlined/info.svg?raw';
import keyboard_arrow_down from '@material-symbols/svg-400/outlined/keyboard_arrow_down.svg?raw';
import download from '@material-symbols/svg-400/outlined/download.svg?raw';
import upload_file from '@material-symbols/svg-400/outlined/upload_file.svg?raw';
import wifi from '@material-symbols/svg-400/outlined/wifi.svg?raw';
import wifi_off from '@material-symbols/svg-400/outlined/wifi_off.svg?raw';
import cloud_off from '@material-symbols/svg-400/outlined/cloud_off.svg?raw';
import refresh from '@material-symbols/svg-400/outlined/refresh.svg?raw';
import person_add from '@material-symbols/svg-400/outlined/person_add.svg?raw';
import group_add from '@material-symbols/svg-400/outlined/group_add.svg?raw';
import logout from '@material-symbols/svg-400/outlined/logout.svg?raw';
import lock from '@material-symbols/svg-400/outlined/lock.svg?raw';
import date_range from '@material-symbols/svg-400/outlined/date_range.svg?raw';
import calendar_today from '@material-symbols/svg-400/outlined/calendar_today.svg?raw';
import block from '@material-symbols/svg-400/outlined/block.svg?raw';
import door_front from '@material-symbols/svg-400/outlined/door_front.svg?raw';
import workspace_premium from '@material-symbols/svg-400/outlined/workspace_premium.svg?raw';
import admin_panel_settings from '@material-symbols/svg-400/outlined/admin_panel_settings.svg?raw';
import event from '@material-symbols/svg-400/outlined/event.svg?raw';
import warning from '@material-symbols/svg-400/outlined/warning.svg?raw';
import lock_clock from '@material-symbols/svg-400/outlined/lock_clock.svg?raw';
import location_on from '@material-symbols/svg-400/outlined/location_on.svg?raw';
import visibility_lock from '@material-symbols/svg-400/outlined/visibility_lock.svg?raw';
import space_dashboard_fill from '@material-symbols/svg-400/outlined/space_dashboard-fill.svg?raw';
import apartment_fill from '@material-symbols/svg-400/outlined/apartment-fill.svg?raw';
import payments_fill from '@material-symbols/svg-400/outlined/payments-fill.svg?raw';
import sell_fill from '@material-symbols/svg-400/outlined/sell-fill.svg?raw';
import history_fill from '@material-symbols/svg-400/outlined/history-fill.svg?raw';
import delete_icono from '@material-symbols/svg-400/outlined/delete.svg?raw';
import pending_actions from '@material-symbols/svg-400/outlined/pending_actions.svg?raw';
import add_location from '@material-symbols/svg-400/outlined/add_location.svg?raw';
import add_business from '@material-symbols/svg-400/outlined/add_business.svg?raw';
import translate from '@material-symbols/svg-400/outlined/translate.svg?raw';
import group_fill from '@material-symbols/svg-400/outlined/group-fill.svg?raw';

const registro = {
  space_dashboard,
  apartment,
  payments,
  sell,
  history,
  group,
  visibility,
  visibility_off,
  edit,
  autorenew,
  swap_vert,
  pause_circle,
  receipt_long,
  all_inclusive,
  add,
  search,
  check_circle,
  schedule,
  event_busy,
  error,
  chevron_left,
  chevron_right,
  check,
  content_copy,
  close,
  arrow_back,
  arrow_forward,
  info,
  keyboard_arrow_down,
  download,
  upload_file,
  wifi,
  wifi_off,
  cloud_off,
  refresh,
  person_add,
  group_add,
  logout,
  lock,
  date_range,
  calendar_today,
  block,
  door_front,
  workspace_premium,
  admin_panel_settings,
  event,
  warning,
  lock_clock,
  location_on,
  visibility_lock,
  space_dashboard_fill,
  apartment_fill,
  payments_fill,
  sell_fill,
  history_fill,
  group_fill,
  delete: delete_icono,
  pending_actions,
  add_location,
  add_business,
  translate,
} as const;

export type NombreIcono = keyof typeof registro;

export function svgDe(nombre: NombreIcono): string {
  return registro[nombre];
}
