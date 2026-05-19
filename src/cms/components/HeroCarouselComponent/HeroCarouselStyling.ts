import type { DisplaySettingsFragment } from '../../../../__generated/sdk';
import { getDictionaryFromDisplaySettings } from '../../../graphql/shared/displaySettingsHelpers';

export interface HeroCarouselStyleConfig {
    carouselHeight: string;
    showNavigation: boolean;
    showPagination: boolean;
    enableAutoplay: boolean;
    autoplayDelay: number;
    enableLoop: boolean;
    transitionSpeed: number;
}

const heightMap: Record<string, string> = {
    h_auto: 'h-auto',
    h_64: 'h-64',
    h_80: 'h-80',
    h_96: 'h-96',
    h_112: 'h-112',
    h_128: 'h-128',
    h_screen: 'h-screen',
};

const autoplayDelayMap: Record<string, number> = {
    delay3s: 3000,
    delay5s: 5000,
    delay7s: 7000,
    delay10s: 10000,
};

const transitionSpeedMap: Record<string, number> = {
    speed300: 300,
    speed500: 500,
    speed800: 800,
    speed1000: 1000,
};

export function getHeroCarouselStyleConfig(
    displaySettings: DisplaySettingsFragment[]
): HeroCarouselStyleConfig {
    const settings = getDictionaryFromDisplaySettings(displaySettings);

    return {
        carouselHeight: heightMap[settings['carouselHeight']] || 'h-96',
        showNavigation: settings['showNavigation'] !== 'false',
        showPagination: settings['showPagination'] !== 'false',
        enableAutoplay: settings['autoplay'] === 'true',
        autoplayDelay: autoplayDelayMap[settings['autoplayDelay']] || 5000,
        enableLoop: settings['loop'] !== 'false',
        transitionSpeed: transitionSpeedMap[settings['transitionSpeed']] || 500,
    };
}
