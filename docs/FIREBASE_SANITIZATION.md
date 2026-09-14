# Funções de Sanitização para Firebase - Projeto White Label

## 🎯 Problema Resolvido

O Firebase Realtime Database não aceita valores `undefined` nas operações de escrita (create/update), gerando o erro:

```
update failed: values argument contains undefined in property
```

## 🛠️ Soluções Implementadas

### 1. `removeUndefinedProperties<T>(data: T): Partial<T>`

**Propósito**: Remove todas as propriedades com valor `undefined` do objeto.

**Características**:

- ✅ Remove propriedades `undefined` recursivamente
- ✅ Mantém propriedades `null` (aceitas pelo Firebase)
- ✅ Preserva arrays e valores primitivos
- ✅ Funciona com objetos aninhados

**Exemplo**:

```typescript
const data = {
  nome: 'João',
  email: undefined,
  telefone: null,
  endereco: {
    rua: 'Rua A',
    numero: undefined,
    complemento: null,
  },
};

const cleanData = removeUndefinedProperties(data);
// Resultado:
// {
//   nome: 'João',
//   telefone: null,
//   endereco: {
//     rua: 'Rua A',
//     complemento: null
//   }
// }
```

### 2. `formatDataToFirebaseRealtime<T>(data: T): Partial<T>`

**Propósito**: Alias para `removeUndefinedProperties` - mais descritivo para uso com Firebase.

**Uso**:

```typescript
import { formatDataToFirebaseRealtime } from '../../functions/sistema.function';

const dadosLimpos = formatDataToFirebaseRealtime(pessoa);
```

### 3. `sanitizeFirebaseData<T>(data: T, removeEmpty?: boolean): Partial<T>`

**Propósito**: Sanitização mais avançada com opção de remover valores vazios.

**Parâmetros**:

- `data`: Objeto a ser sanitizado
- `removeEmpty` (opcional): Se `true`, remove também strings vazias, arrays vazios e objetos vazios

**Exemplo**:

```typescript
const data = {
  nome: 'João',
  email: '',
  telefones: [],
  endereco: {},
  observacoes: undefined,
};

// Apenas remove undefined
const basic = sanitizeFirebaseData(data);
// {
//   nome: 'João',
//   email: '',
//   telefones: [],
//   endereco: {}
// }

// Remove undefined E valores vazios
const advanced = sanitizeFirebaseData(data, true);
// {
//   nome: 'João'
// }
```

## 🔧 Implementação Automática

As funções já estão integradas automaticamente no `FirebaseService`:

### SetDataFromFirestore (Create)

```typescript
public async setDataFromFirestore<T>(
  collection: ECollectionFirebase,
  data: T,
  successMessage?: string
): Promise<void> {
  // 1. Adiciona timestamps
  const dataWithDates = createDateTimeFirebase<T>(data);

  // 2. Remove undefined automaticamente
  const cleanData = removeUndefinedProperties(dataWithDates);

  // 3. Salva no Firebase
  return set(newDataRef, cleanData);
}
```

### UpdateDataFromFirestore (Update)

```typescript
public async updateDataFromFirestore<T>(
  collection: ECollectionFirebase,
  id: string,
  data: T,
  successMessage?: string
): Promise<void> {
  // 1. Adiciona timestamp de atualização
  const dataWithUpdatedAt = updateDateTimeFirebase<T>(data);

  // 2. Remove undefined automaticamente
  const cleanData = removeUndefinedProperties(dataWithUpdatedAt);

  // 3. Atualiza no Firebase
  return update(dataRef, cleanData);
}
```

## 📝 Uso Manual (Se Necessário)

Se precisar usar as funções manualmente em outros contextos:

```typescript
import {
  removeUndefinedProperties,
  formatDataToFirebaseRealtime,
  sanitizeFirebaseData,
} from '../../shared/functions/sistema.function';

// Exemplo 1: Limpeza básica
const pessoa = { nome: 'João', email: undefined };
const pessoaLimpa = removeUndefinedProperties(pessoa);

// Exemplo 2: Para Firebase especificamente
const dadosFirebase = formatDataToFirebaseRealtime(pessoa);

// Exemplo 3: Limpeza avançada
const dadosCompletos = sanitizeFirebaseData(pessoa, true);
```

## 🧪 Casos de Teste

### Teste 1: Objeto Simples

```typescript
const input = { a: 1, b: undefined, c: null, d: '' };
const output = removeUndefinedProperties(input);
// Esperado: { a: 1, c: null, d: '' }
```

### Teste 2: Objeto Aninhado

```typescript
const input = {
  user: {
    name: 'João',
    email: undefined,
    address: {
      street: 'Rua A',
      number: undefined,
    },
  },
};
const output = removeUndefinedProperties(input);
// Esperado: {
//   user: {
//     name: 'João',
//     address: {
//       street: 'Rua A'
//     }
//   }
// }
```

### Teste 3: Arrays

```typescript
const input = { items: [1, undefined, 3], tags: [] };
const output = removeUndefinedProperties(input);
// Esperado: { items: [1, undefined, 3], tags: [] }
// Arrays são preservados como estão
```

## ⚠️ Importante

1. **Automático**: As funções já estão integradas nos métodos do `FirebaseService`
2. **Transparente**: Você não precisa mudar seu código existente
3. **Seguro**: Não altera o objeto original, retorna uma cópia limpa
4. **Recursivo**: Funciona com objetos aninhados de qualquer profundidade
5. **Performance**: Otimizado para não processar desnecessariamente

## 🎉 Resultado

O erro `"update failed: values argument contains undefined in property"` foi **completamente eliminado**!
