// Figma '새 디자인 시안 · 모바일 (라이트)' 에서 내려받은 아이콘 (src/assets/figma)
//   색이 들어간 SVG 라서, 켜짐/꺼짐처럼 색이 다른 경우는 파일이 따로 있다 (tab-home-on / tab-home-off …)
import arrowRightSub from '../assets/figma/arrow-right-sub.svg';
import back from '../assets/figma/back.svg';
import back24 from '../assets/figma/back-24.svg';
import building from '../assets/figma/building.svg';
import camera from '../assets/figma/camera.svg';
import checkGreen from '../assets/figma/check-green.svg';
import checkGreen14 from '../assets/figma/check-green-14.svg';
import checkWhite from '../assets/figma/check-white.svg';
import checkWhite16 from '../assets/figma/check-white-16.svg';
import checkWhite32 from '../assets/figma/check-white-32.svg';
import chevDown from '../assets/figma/chev-down.svg';
import chevDown14 from '../assets/figma/chev-down-14.svg';
import chevDown16 from '../assets/figma/chev-down-16.svg';
import chevDown18 from '../assets/figma/chev-down-18.svg';
import chevLeftDark from '../assets/figma/chev-left-dark.svg';
import chevRightDark from '../assets/figma/chev-right-dark.svg';
import chevRightPrimary from '../assets/figma/chev-right-primary.svg';
import chevRightSub from '../assets/figma/chev-right-sub.svg';
import chevUp from '../assets/figma/chev-up.svg';
import clockSm from '../assets/figma/clock-sm.svg';
import close24 from '../assets/figma/close-24.svg';
import closeX from '../assets/figma/close-x.svg';
import copy from '../assets/figma/copy.svg';
import dotBefore from '../assets/figma/dot-before.svg';
import dotDoing from '../assets/figma/dot-doing.svg';
import dotDone from '../assets/figma/dot-done.svg';
import editDark from '../assets/figma/edit-dark.svg';
import editWhite from '../assets/figma/edit-white.svg';
import expand from '../assets/figma/expand.svg';
import filter from '../assets/figma/filter.svg';
import image from '../assets/figma/image.svg';
import image20 from '../assets/figma/image-20.svg';
import image40 from '../assets/figma/image-40.svg';
import infoSub from '../assets/figma/info-sub.svg';
import infoWarn from '../assets/figma/info-warn.svg';
import locate from '../assets/figma/locate.svg';
import lock from '../assets/figma/lock.svg';
import logoGeo from '../assets/figma/logo-geo.svg';
import logoIt from '../assets/figma/logo-it.svg';
import markerHalo from '../assets/figma/marker-halo.svg';
import mic from '../assets/figma/mic.svg';
import more from '../assets/figma/more.svg';
import navBtn from '../assets/figma/nav-btn.svg';
import navDark from '../assets/figma/nav-dark.svg';
import navPrimary from '../assets/figma/nav-primary.svg';
import pin from '../assets/figma/pin.svg';
import route from '../assets/figma/route.svg';
import routeSm from '../assets/figma/route-sm.svg';
import search from '../assets/figma/search.svg';
import segBuildingOn from '../assets/figma/seg-building-on.svg';
import segUsersOff from '../assets/figma/seg-users-off.svg';
import share from '../assets/figma/share.svg';
import sort from '../assets/figma/sort.svg';
import swap from '../assets/figma/swap.svg';
import tabCalendarOff from '../assets/figma/tab-calendar-off.svg';
import tabCalendarOn from '../assets/figma/tab-calendar-on.svg';
import tabCheckOff from '../assets/figma/tab-check-off.svg';
import tabCheckOn from '../assets/figma/tab-check-on.svg';
import tabHomeOff from '../assets/figma/tab-home-off.svg';
import tabHomeOn from '../assets/figma/tab-home-on.svg';
import tabTalkOff from '../assets/figma/tab-talk-off.svg';
import tabTalkOn from '../assets/figma/tab-talk-on.svg';
import text from '../assets/figma/text.svg';
import volume from '../assets/figma/volume.svg';

export const FIG = {
  arrowRightSub, back, back24, building, camera, checkGreen, checkGreen14, checkWhite, checkWhite16, checkWhite32,
  chevDown, chevDown14, chevDown16, chevDown18, chevLeftDark, chevRightDark, chevRightPrimary, chevRightSub, chevUp,
  clockSm, close24, closeX, copy, dotBefore, dotDoing, dotDone, editDark, editWhite, expand, filter, image, image20, image40,
  infoSub, infoWarn, locate, lock, logoGeo, logoIt, markerHalo, mic, more, navBtn, navDark, navPrimary, pin,
  route, routeSm, search, segBuildingOn, segUsersOff, share, sort, swap,
  tabCalendarOff, tabCalendarOn, tabCheckOff, tabCheckOn, tabHomeOff, tabHomeOn, tabTalkOff, tabTalkOn, text, volume,
};
export type FigIcon = keyof typeof FIG;

/** 디자인의 아이콘 칸 크기 그대로 (size = 가로세로 px) */
export function Ico({ name, size, className = '' }: { name: FigIcon; size: number; className?: string }) {
  return <img src={FIG[name]} width={size} height={size} alt="" aria-hidden className={`ico ${className}`} draggable={false} />;
}
