import js from '@eslint/js';
import tseslint from 'typescript-eslint';

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
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression[callee.property.name=/^(query|execute|consultar|ejecutar)$/] > TemplateLiteral[expressions.length>0]',
          message: 'SQL con valores interpolados: usa placeholders `?` (ADR 0002).',
        },
        {
          selector:
            'CallExpression[callee.name=/^(query|execute|consultar)$/] > TemplateLiteral[expressions.length>0]',
          message: 'SQL con valores interpolados: usa placeholders `?` (ADR 0002).',
        },
        {
          selector:
            'CallExpression[callee.property.name=/^(query|execute|consultar)$/] > BinaryExpression[operator="+"] :matches(Identifier, MemberExpression, CallExpression)',
          message: 'SQL concatenado con un valor: usa placeholders `?` (ADR 0002).',
        },
        {
          selector:
            'VariableDeclarator[id.name=/^(sql|consulta|query)$/i] > TemplateLiteral[expressions.length>0]',
          message: 'SQL con valores interpolados: usa placeholders `?` (ADR 0002).',
        },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['eslint.config.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
