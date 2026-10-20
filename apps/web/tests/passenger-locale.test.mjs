import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

// Use the project's TypeScript compiler so these tests need no test dependency.
const testDirectory = dirname(fileURLToPath(import.meta.url));
const cache = new Map();
function loadTypeScript(path) {
  if (cache.has(path)) return cache.get(path);
  const module = { exports: {} };
  cache.set(path, module.exports);
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText;
  const localRequire = specifier => specifier.startsWith('.')
    ? loadTypeScript(resolve(dirname(path), `${specifier}.ts`)) : createRequire(path)(specifier);
  vm.runInThisContext(`(function(require, module, exports) { ${code}\n})`, { filename: path })(localRequire, module, module.exports);
  return module.exports;
}
const { createPassengerLocale, dictionaries, passengerLanguages, passengerLanguageStorageKey,
  readPassengerLanguage, resolvePassengerLanguage, savePassengerLanguage, translate } = loadTypeScript(
  resolve(testDirectory, '../src/screens/Passenger/i18n/locale.ts'));

test('all five dictionaries have complete, nonempty resources and identical interpolation variables', () => {
  assert.deepEqual(passengerLanguages.map(language => language.code), ['en', 'ru', 'zh-CN', 'de', 'fr']);
  const placeholders = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const language of passengerLanguages) {
    const dictionary = dictionaries[language.code];
    assert.deepEqual(Object.keys(dictionary).sort(), Object.keys(dictionaries.en).sort());
    for (const [key, value] of Object.entries(dictionary)) {
      assert.ok(value.trim(), `${language.code}.${key} is empty`);
      assert.deepEqual(placeholders(value), placeholders(dictionaries.en[key]), `${language.code}.${key}`);
    }
  }
});

test('English is the default for absent, invalid, or inaccessible storage', () => {
  for (const value of [null, undefined, '', 'es', 'RU', {}, 'constructor']) {
    assert.equal(resolvePassengerLanguage(value), 'en');
    assert.equal(readPassengerLanguage({ getItem: () => value }), 'en');
  }
  assert.equal(readPassengerLanguage({ getItem() { throw new Error('Storage blocked'); } }), 'en');
});

test('persistence touches only the passenger language key and tolerates blocked storage', () => {
  const saved = new Map([['wwms.passenger.sessionToken', 'unchanged'], ['auth', 'unchanged']]);
  const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  for (const { code } of passengerLanguages) {
    savePassengerLanguage(code, storage);
    assert.equal(readPassengerLanguage(storage), code);
    assert.equal(saved.get(passengerLanguageStorageKey), code);
  }
  assert.equal(saved.get('wwms.passenger.sessionToken'), 'unchanged');
  assert.equal(saved.get('auth'), 'unchanged');
  assert.equal(saved.size, 3);
  assert.doesNotThrow(() => savePassengerLanguage('ru', { setItem() { throw new Error('Storage blocked'); } }));
});

test('missing translations safely fall back to English', () => {
  assert.equal(translate('de', 'welcome', {}, {}), dictionaries.en.welcome);
  assert.equal(translate('fr', 'welcome', {}, { welcome: '' }), dictionaries.en.welcome);
});

test('interpolation preserves proper names and identifiers verbatim', () => {
  for (const { code } of passengerLanguages) {
    const locale = createPassengerLocale(code);
    const name = '$& Blue Whale {name} 张三';
    assert.ok(locale.t('personalQrTitle', { name }).includes(name));
    assert.ok(locale.t('passengerReference', { id: '00123-ABC' }).includes('00123-ABC'));
  }
});

test('counts follow Russian, Chinese, French, German, and English plural rules', () => {
  const ru = createPassengerLocale('ru');
  assert.equal(ru.peopleAdded(1), 'Добавлен 1 человек');
  assert.equal(ru.peopleAdded(2), 'Добавлено 2 человека');
  assert.equal(ru.peopleAdded(5), 'Добавлено 5 человек');
  assert.equal(ru.peopleAdded(21), 'Добавлен 21 человек');
  assert.equal(createPassengerLocale('zh-CN').peopleAdded(5), '已添加 5 人');
  assert.equal(createPassengerLocale('de').peopleAdded(1), '1 Person hinzugefügt');
  assert.equal(createPassengerLocale('fr').peopleAdded(2), '2 personnes ajoutées');
  assert.equal(createPassengerLocale('en').peopleAdded(0), '0 people added');
});

test('enum display and known server messages change language without changing source values', () => {
  const status = 'NeedsReschedule';
  const message = 'This trip has reached its maximum passenger capacity.';
  for (const { code } of passengerLanguages) {
    const locale = createPassengerLocale(code);
    assert.equal(locale.displayValue(status), dictionaries[code].needsReschedule);
    assert.equal(locale.translateMessage(message), dictionaries[code].capacityReached);
    assert.equal(locale.translateMessage('requiredFields'), dictionaries[code].requiredFields);
    assert.equal(locale.translateMessage('Unrecognized diagnostic: abc-123'), 'Unrecognized diagnostic: abc-123');
    assert.equal(locale.displayValue('Custom official value'), 'Custom official value');
    assert.equal(locale.displayValue('constructor'), 'constructor');
  }
  assert.equal(status, 'NeedsReschedule');
  assert.equal(message, 'This trip has reached its maximum passenger capacity.');
});

test('dates, numbers, countries, and field validation use the selected locale', () => {
  const date = new Date('2026-10-20T06:30:00Z');
  const original = date.toISOString();
  for (const { code } of passengerLanguages) {
    const locale = createPassengerLocale(code);
    const options = { dateStyle: 'full', timeStyle: 'short' };
    assert.equal(locale.date(date, options), new Intl.DateTimeFormat(code, options).format(date));
    assert.equal(locale.number(12345.67), new Intl.NumberFormat(code).format(12345.67));
    assert.equal(locale.countryName('LK'), new Intl.DisplayNames([code], { type: 'region' }).of('LK'));
    assert.equal(locale.translateMessage('The Name field is required.'), locale.t('invalidField', { field: locale.t('name') }));
    assert.equal(locale.translateMessage("The field Gender must match the regular expression '^(male|female|other)$'."), locale.t('invalidField', { field: locale.t('gender') }));
    assert.equal(locale.translateMessage("The field Name must be a string or array type with a maximum length of '160'."), locale.t('tooLong', { field: locale.t('name'), count: 160 }));
  }
  assert.equal(date.toISOString(), original);
});

test('passenger JSX has no untranslated literal labels or accessibility text', () => {
  const root = resolve(testDirectory, '../src/screens/Passenger');
  const paths = [root, resolve(root, 'components')].flatMap(directory =>
    readdirSync(directory).filter(file => file.endsWith('.tsx')).map(file => resolve(directory, file)));
  for (const path of paths) {
    const ast = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isJsxText(node)) assert.ok(!/\p{L}/u.test(node.text), `${path}: untranslated JSX ${node.text.trim()}`);
      if (ts.isJsxAttribute(node) && ['alt', 'placeholder', 'aria-label', 'label', 'title'].includes(node.name.text)) {
        assert.ok(!node.initializer || !ts.isStringLiteral(node.initializer), `${path}: untranslated ${node.name.text}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
});

test('known passenger API and backend messages have translation resources', () => {
  const english = new Set(Object.values(dictionaries.en));
  for (const file of ['passengerTripApi.ts', 'complaintsApi.ts']) {
    const path = resolve(testDirectory, '../src/screens/Passenger', file);
    const ast = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isStringLiteral(node) && node.text.endsWith('.') && node.text.includes(' ') && node.text !== 'Unable to load complaints.') {
        assert.ok(english.has(node.text), `${file}: missing ${node.text}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  for (const file of ['PassengerTripController.cs', 'PassengerSosController.cs', 'ComplaintsController.cs', 'PassengerCountryPolicy.cs', 'PassengerBoatLocationPolicy.cs']) {
    const source = readFileSync(resolve(testDirectory, '../../../server/Passenger', file), 'utf8');
    const patterns = file === 'PassengerBoatLocationPolicy.cs'
      ? /"([^"\n]+)"/g : /(?:message\s*=\s*|error\s*=\s*|ValidationProblem\()"([^"\n]+)"/g;
    for (const match of source.matchAll(patterns)) assert.ok(english.has(match[1]), `${file}: missing ${match[1]}`);
  }
});
