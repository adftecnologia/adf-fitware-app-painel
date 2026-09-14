# Validação de Telefone - Documentação

Este documento explica como implementar e usar a validação de telefone no projeto.

## 📋 Estrutura dos Arquivos

### Arquivos Criados

- `src/app/shared/pipes/telefone.pipe.ts` - Pipe para formatação visual
- `src/app/shared/directives/telefone-mask.directive.ts` - Diretiva para máscara de input
- `src/app/shared/validators/telefone.validators.ts` - Validators customizados

## 🎯 Como Usar

### 1. Importações Necessárias

```typescript
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TelefoneValidators } from '../../shared/validators/telefone.validators';
import { TelefonePipe } from '../../shared/pipes/telefone.pipe';
import { TelefoneMaskDirective } from '../../shared/directives/telefone-mask.directive';
```

### 2. Configuração do FormGroup

```typescript
export class PessoasComponent {
  pessoaForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.pessoaForm = this.fb.group({
      nome: ['', [Validators.required]],

      // OPÇÃO 1: Validator completo (recomendado)
      telefone: [
        '',
        [Validators.required, TelefoneValidators.telefoneValido()],
      ],

      // OPÇÃO 2: Apenas tamanho mínimo
      // telefone: ['', [
      //   Validators.required,
      //   TelefoneValidators.tamanhoMinimo(15)
      // ]],

      // outros campos...
    });
  }

  // Getter para acessar facilmente o controle do telefone
  get telefone() {
    return this.pessoaForm.get('telefone');
  }

  // Método para obter mensagem de erro personalizada
  getTelefoneErrorMessage(): string {
    const telefoneControl = this.telefone;

    if (telefoneControl?.hasError('required')) {
      return 'Telefone é obrigatório';
    }

    if (telefoneControl?.hasError('telefoneInvalido')) {
      const error = telefoneControl.errors?.['telefoneInvalido'];
      return error.message;
    }

    if (telefoneControl?.hasError('tamanhoMinimo')) {
      const error = telefoneControl.errors?.['tamanhoMinimo'];
      return error.message;
    }

    return '';
  }
}
```

### 3. Template HTML

#### Para Exibição (Tabelas)

```html
<td>{{ pessoa.telefone | telefone }}</td>
```

#### Para Input (Formulários)

```html
<div class="col-md-6">
  <div class="mb-3">
    <label class="form-label">Telefone *</label>
    <input
      type="text"
      class="form-control"
      formControlName="telefone"
      appTelefoneMask
      placeholder="(11) 99999-9999"
      [class.is-invalid]="telefone?.invalid && telefone?.touched"
    />
    <div
      *ngIf="telefone?.invalid && telefone?.touched"
      class="invalid-feedback"
    >
      <div *ngIf="telefone?.hasError('required')">Telefone é obrigatório</div>
      <div *ngIf="telefone?.hasError('telefoneInvalido')">
        {{ telefone?.errors?.['telefoneInvalido']?.message }}
      </div>
      <div *ngIf="telefone?.hasError('tamanhoMinimo')">
        {{ telefone?.errors?.['tamanhoMinimo']?.message }}
      </div>
    </div>
  </div>
</div>
```

### 4. Importação no Componente (Standalone)

```typescript
@Component({
  selector: 'app-pessoas',
  templateUrl: './pessoas.component.html',
  styleUrls: ['./pessoas.component.css'],
  imports: [
    // ... outras importações
    TelefonePipe,
    TelefoneMaskDirective,
  ],
})
export class PessoasComponent {
  // ... implementação
}
```

## 🔧 Opções de Validators

### 1. `TelefoneValidators.telefoneValido()` (Recomendado)

- ✅ Valida tamanho (10-11 dígitos)
- ✅ Valida formato de celular (3º dígito = 9)
- ✅ Valida DDD brasileiro
- ✅ Mensagens de erro específicas

### 2. `TelefoneValidators.tamanhoMinimo(15)` (Simples)

- ✅ Apenas valida tamanho mínimo de caracteres
- ✅ Personalizável (qualquer tamanho)

## 📱 Formatos Suportados

- ✅ `(11) 99999-9999` - Celular com DDD
- ✅ `(11) 9999-9999` - Fixo com DDD
- ✅ `99999-9999` - Celular sem DDD
- ✅ `9999-9999` - Fixo sem DDD

## 🚨 Mensagens de Erro

- **Campo vazio**: "Telefone é obrigatório"
- **Muito curto**: "Telefone deve ter pelo menos 10 dígitos"
- **Muito longo**: "Telefone deve ter no máximo 11 dígitos"
- **Celular inválido**: "Para celular, o terceiro dígito deve ser 9"
- **DDD inválido**: "DDD inválido"

## 🎯 Exemplos de Validação

- ❌ `(11) 1234-567` → "Telefone deve ter pelo menos 10 dígitos"
- ✅ `(11) 1234-5678` → Válido (telefone fixo)
- ❌ `(11) 1234-56789` → "Para celular, o terceiro dígito deve ser 9"
- ✅ `(11) 91234-5678` → Válido (celular)
- ❌ `(99) 91234-5678` → "DDD inválido"

## 🛠️ Funcionalidades

- ✅ **Integração perfeita** com a diretiva de máscara
- ✅ **Validação em tempo real** conforme o usuário digita
- ✅ **Mensagens específicas** para cada tipo de erro
- ✅ **DDDs válidos** do Brasil todos cadastrados
- ✅ **Performance otimizada** - só valida quando necessário
- ✅ **Zero dependências** - Bundle otimizado
- ✅ **Standalone** - Funciona com Angular moderno
