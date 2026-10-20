import { en } from './locales/en';
import { ru } from './locales/ru';
import { zhCN } from './locales/zh-CN';
import { de } from './locales/de';
import { fr } from './locales/fr';

export const passengerLanguages = [
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Русский' },
  { code: 'zh-CN', name: '简体中文' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
] as const;

export type PassengerLanguage = typeof passengerLanguages[number]['code'];
export type TranslationKey = keyof typeof en;
type Variables = Record<string, string | number>;
export const passengerLanguageStorageKey = 'wwms.passenger.language';
export const dictionaries = { en, ru, 'zh-CN': zhCN, de, fr };

export function resolvePassengerLanguage(value: unknown): PassengerLanguage {
  return passengerLanguages.some(({ code }) => code === value) ? value as PassengerLanguage : 'en';
}

export function readPassengerLanguage(storage?: Pick<Storage, 'getItem'>): PassengerLanguage {
  try {
    return resolvePassengerLanguage((storage ?? window.localStorage).getItem(passengerLanguageStorageKey));
  } catch {
    return 'en';
  }
}

export function savePassengerLanguage(language: PassengerLanguage, storage?: Pick<Storage, 'setItem'>): void {
  try {
    (storage ?? window.localStorage).setItem(passengerLanguageStorageKey, language);
  } catch {
    // The selection still works for this visit when browser storage is unavailable.
  }
}

export function translate(language: PassengerLanguage, key: TranslationKey, variables: Variables = {}, resources: Partial<Record<TranslationKey, string>> = dictionaries[language]): string {
  const template = resources[key] || en[key];
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = variables[name];
    return value === undefined ? placeholder : typeof value === 'number'
      ? new Intl.NumberFormat(language).format(value) : value;
  });
}

// These map API enums to display labels only. Values sent to the API stay unchanged.
const displayKeys: Record<string, TranslationKey> = {
  local: 'local', foreign: 'foreign', male: 'male', female: 'female', other: 'other',
  adult: 'adult', child: 'child', small: 'small', specialneeds: 'specialNeeds',
  Scheduled: 'scheduled', Boarding: 'boarding', Ongoing: 'ongoing', Completed: 'completed',
  Cancelled: 'cancelled', Declined: 'declined', NeedsReschedule: 'needsReschedule',
  Pending: 'pending', Approved: 'approved', Online: 'online', Offline: 'offline',
  Stale: 'stale', Unavailable: 'unavailable', Unknown: 'unknown',
};

// Match only known application messages, never passenger-entered or official data.
const messageKeys = new Map<string, TranslationKey>(Object.entries(en).map(([key, value]) => [value, key as TranslationKey]));
const fieldKeys: Record<string, TranslationKey> = {
  Name: 'name', IdentificationNumber: 'identification', PhoneNumber: 'phoneNumber',
  PassengerType: 'passengerType', CountryCode: 'country', Gender: 'gender',
  AgeCategory: 'ageCategory', SpecialNeedType: 'specialNeed', Identifier: 'identification',
};

export function createPassengerLocale(language: PassengerLanguage) {
  const t = (key: TranslationKey, variables?: Variables) => translate(language, key, variables);
  const regionNames = new Intl.DisplayNames([language], { type: 'region' });
  return {
    locale: language,
    t,
    number: (value: number) => new Intl.NumberFormat(language).format(value),
    date: (value: Date | number, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(language, options).format(value),
    countryName: (code: string, fallback = code) => regionNames.of(code) ?? fallback,
    displayValue: (value: string) => Object.hasOwn(displayKeys, value) ? t(displayKeys[value]) : value,
    peopleAdded: (count: number) => {
      const plural = new Intl.PluralRules(language).select(count);
      const key = `peopleAdded_${plural}` as TranslationKey;
      return t(key in en ? key : 'peopleAdded_other', { count });
    },
    translateMessage: (message: string | null | undefined): string => {
      if (!message) return '';
      if (Object.hasOwn(en, message)) return t(message as TranslationKey);
      const key = messageKeys.get(message);
      if (key) return t(key);
      if (['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.'].includes(message)) return t('networkFailed');
      const fieldError = /^(?:The (\w+) field (?:is required\.|is not a valid phone number\.)|The field (\w+) must match the regular expression '.*'\.)$/.exec(message);
      const field = fieldError?.[1] ?? fieldError?.[2];
      if (field && Object.hasOwn(fieldKeys, field)) return t('invalidField', { field: t(fieldKeys[field]) });
      const lengthError = /^The field (\w+) must be a string or array type with a maximum length of '(\d+)'\.$/.exec(message);
      if (lengthError && Object.hasOwn(fieldKeys, lengthError[1])) return t('tooLong', { field: t(fieldKeys[lengthError[1]]), count: Number(lengthError[2]) });
      // Unknown server diagnostics remain intact so their meaning is not hidden.
      return message;
    },
  };
}
