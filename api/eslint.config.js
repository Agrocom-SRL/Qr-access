import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const MENSAJE_SQL = 'SQL con valores interpolados: usa placeholders `?` (ADR 0002, ADR 0033 §2).';
const PALABRA_SQL = '(SELECT|INSERT|UPDATE|DELETE|WHERE|ORDER|FROM|JOIN|AND|SET)';
const NOMBRE_SQL = '/^(sql|consulta|query)$/i';

/**
 * Reglas contra SQL armado con plantillas, independientes del nombre de la variable o de cómo
 * se use después (array.join, concat, plantilla etiquetada, objeto `{ sql }`): marcan toda
 * plantilla con expresiones cuyo texto empieza como un SQL, más las que se asignan a algo
 * llamado sql/consulta/query y la concatenación con `+` dentro de una llamada a la base.
 */
export const REGLAS_SQL = [
  {
    selector: `TemplateLiteral[expressions.length>0][quasis.0.value.raw=/^\\s*${PALABRA_SQL}\\b/i]`,
    message: MENSAJE_SQL,
  },
  ...[
    'VariableDeclarator[id.name=NOMBRE]',
    'AssignmentExpression[left.name=NOMBRE]',
    'AssignmentExpression[left.property.name=NOMBRE]',
    'Property[key.name=NOMBRE]',
  ].map((base) => ({
    selector: `${base.replace('NOMBRE', NOMBRE_SQL)} > TemplateLiteral[expressions.length>0]`,
    message: MENSAJE_SQL,
  })),
  {
    selector:
      'CallExpression[callee.property.name=/^(query|execute|consultar|ejecutar)$/] > TemplateLiteral[expressions.length>0]',
    message: MENSAJE_SQL,
  },
  {
    selector:
      'CallExpression[callee.name=/^(query|execute|consultar)$/] > TemplateLiteral[expressions.length>0]',
    message: MENSAJE_SQL,
  },
  {
    selector:
      'CallExpression[callee.property.name=/^(query|execute|consultar)$/] > BinaryExpression[operator="+"] :matches(Identifier, MemberExpression, CallExpression)',
    message: 'SQL concatenado con un valor: usa placeholders `?` (ADR 0002).',
  },
];

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/', '.dependency-cruiser.cjs'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // SQL a mano (ADR 0002, ADR 0033 §2): un template literal con valores o una concatenación
      // dentro de un SQL es una inyección. Los valores van como `?`; un identificador dinámico
      // sale de una lista blanca, nunca de una plantilla.
      'no-restricted-syntax': ['error', ...REGLAS_SQL],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['eslint.config.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
