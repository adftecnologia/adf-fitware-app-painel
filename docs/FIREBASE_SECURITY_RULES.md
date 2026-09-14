# Firebase Security Rules - Projeto White Label

## 📋 Sumário

1. [Regras Básicas (Atual)](#regras-básicas-atual)
2. [Regras Avançadas Recomendadas](#regras-avançadas-recomendadas)
3. [Validação de Dados](#validação-de-dados)
4. [Controle de Acesso por Usuário](#controle-de-acesso-por-usuário)
5. [Implementação de Roles/Perfis](#implementação-de-rolesperfis)
6. [Auditoria e Logs](#auditoria-e-logs)

## 🔓 Regras Básicas (Atual)

```json
{
  "rules": {
    ".read": "auth != null && auth.token.status == 'Ativo'",
    ".write": "auth != null && auth.token.status == 'Ativo'"
  }
}
```

**Problemas da regra atual:**

- ❌ Qualquer usuário autenticado pode ler/escrever TUDO
- ❌ Não há validação de dados
- ❌ Não há controle granular de acesso
- ❌ Usuários podem deletar dados de outros
- ❌ Não há auditoria de mudanças

## 🔒 Regras Avançadas Recomendadas

### Versão 1: Regras Básicas Melhoradas

```json
{
  "rules": {
    ".read": false,
    ".write": false,

    "pessoas": {
      ".read": "auth != null && auth.token.email_verified == true",
      ".write": "auth != null && auth.token.email_verified == true",
      "$pessoaId": {
        ".validate": "newData.hasChildren(['nome', 'telefone', 'dataInicio', 'secretaria', 'createdAt']) &&
                     newData.child('nome').isString() &&
                     newData.child('nome').val().length > 2 &&
                     newData.child('telefone').isString() &&
                     newData.child('email').isString() &&
                     newData.child('createdAt').isString()",

        "nome": {
          ".validate": "newData.isString() && newData.val().length > 2 && newData.val().length <= 100"
        },
        "telefone": {
          ".validate": "newData.isString() && newData.val().matches(/^\\([0-9]{2}\\) [0-9]{4,5}-[0-9]{4}$/)"
        },
        "email": {
          ".validate": "newData.isString() && newData.val().matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/)"
        },
        "salario": {
          ".validate": "newData.isNumber() && newData.val() >= 0"
        },
        "dataInicio": {
          ".validate": "newData.isString() && newData.val().matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)"
        },
        "createdAt": {
          ".validate": "newData.isString() && (!data.exists() || data.val() == newData.val())"
        },
        "updatedAt": {
          ".validate": "newData.isString()"
        },
        "$other": {
          ".validate": false
        }
      }
    },

    "indicantes": {
      ".read": "auth != null && auth.token.email_verified == true",
      ".write": "auth != null && auth.token.email_verified == true",
      "$indicanteId": {
        ".validate": "newData.hasChildren(['nome', 'createdAt']) &&
                     newData.child('nome').isString() &&
                     newData.child('nome').val().length > 2",

        "nome": {
          ".validate": "newData.isString() && newData.val().length > 2 && newData.val().length <= 100"
        },
        "createdAt": {
          ".validate": "newData.isString() && (!data.exists() || data.val() == newData.val())"
        },
        "updatedAt": {
          ".validate": "newData.isString()"
        },
        "$other": {
          ".validate": false
        }
      }
    },

    "secretarias": {
      ".read": "auth != null && auth.token.email_verified == true",
      ".write": "auth != null && auth.token.email_verified == true",
      "$secretariaId": {
        ".validate": "newData.hasChildren(['nome', 'createdAt']) &&
                     newData.child('nome').isString() &&
                     newData.child('nome').val().length > 2",

        "nome": {
          ".validate": "newData.isString() && newData.val().length > 2 && newData.val().length <= 100"
        },
        "createdAt": {
          ".validate": "newData.isString() && (!data.exists() || data.val() == newData.val())"
        },
        "updatedAt": {
          ".validate": "newData.isString()"
        },
        "$other": {
          ".validate": false
        }
      }
    }
  }
}
```

### Versão 2: Com Sistema de Roles/Perfis

```json
{
  "rules": {
    ".read": false,
    ".write": false,

    "users": {
      "$userId": {
        ".read": "auth != null && (auth.uid == $userId || root.child('users').child(auth.uid).child('role').val() == 'admin')",
        ".write": "auth != null && auth.uid == $userId",

        "email": {
          ".validate": "newData.isString() && newData.val() == auth.token.email"
        },
        "role": {
          ".validate": "newData.isString() && (newData.val() == 'user' || newData.val() == 'admin' || newData.val() == 'manager')"
        },
        "createdAt": {
          ".validate": "newData.isString() && !data.exists()"
        },
        "lastLogin": {
          ".validate": "newData.isString()"
        },
        "$other": {
          ".validate": false
        }
      }
    },

    "pessoas": {
      ".read": "auth != null && auth.token.email_verified == true &&
               (root.child('users').child(auth.uid).child('role').val() == 'admin' ||
                root.child('users').child(auth.uid).child('role').val() == 'manager' ||
                root.child('users').child(auth.uid).child('role').val() == 'user')",
      ".write": "auth != null && auth.token.email_verified == true &&
                (root.child('users').child(auth.uid).child('role').val() == 'admin' ||
                 root.child('users').child(auth.uid).child('role').val() == 'manager')",

      "$pessoaId": {
        ".validate": "newData.hasChildren(['nome', 'telefone', 'dataInicio', 'secretaria', 'createdAt', 'createdBy']) &&
                     newData.child('nome').isString() &&
                     newData.child('nome').val().length > 2 &&
                     newData.child('telefone').isString() &&
                     newData.child('createdBy').val() == auth.uid",

        "nome": {
          ".validate": "newData.isString() && newData.val().length > 2 && newData.val().length <= 100"
        },
        "telefone": {
          ".validate": "newData.isString() && newData.val().matches(/^\\([0-9]{2}\\) [0-9]{4,5}-[0-9]{4}$/)"
        },
        "email": {
          ".validate": "newData.isString() && newData.val().matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/)"
        },
        "salario": {
          ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 50000"
        },
        "createdBy": {
          ".validate": "newData.isString() && newData.val() == auth.uid && (!data.exists() || data.val() == newData.val())"
        },
        "updatedBy": {
          ".validate": "newData.isString() && newData.val() == auth.uid"
        },
        "createdAt": {
          ".validate": "newData.isString() && (!data.exists() || data.val() == newData.val())"
        },
        "updatedAt": {
          ".validate": "newData.isString()"
        }
      }
    },

    "indicantes": {
      ".read": "auth != null && auth.token.email_verified == true",
      ".write": "auth != null && auth.token.email_verified == true &&
                (root.child('users').child(auth.uid).child('role').val() == 'admin' ||
                 root.child('users').child(auth.uid).child('role').val() == 'manager')"
    },

    "secretarias": {
      ".read": "auth != null && auth.token.email_verified == true",
      ".write": "auth != null && auth.token.email_verified == true &&
                root.child('users').child(auth.uid).child('role').val() == 'admin'"
    },

    "audit_logs": {
      ".read": "auth != null && root.child('users').child(auth.uid).child('role').val() == 'admin'",
      ".write": false,
      "$logId": {
        ".validate": "newData.hasChildren(['action', 'userId', 'timestamp', 'resource']) &&
                     newData.child('userId').val() == auth.uid"
      }
    }
  }
}
```

### Versão 3: Máxima Segurança com Auditoria

```json
{
  "rules": {
    ".read": false,
    ".write": false,

    "users": {
      "$userId": {
        ".read": "auth != null && auth.uid == $userId",
        ".write": "auth != null && auth.uid == $userId",

        "profile": {
          "email": {
            ".validate": "newData.isString() && newData.val() == auth.token.email"
          },
          "displayName": {
            ".validate": "newData.isString() && newData.val().length >= 2 && newData.val().length <= 50"
          },
          "role": {
            ".validate": "newData.isString() && (newData.val() == 'user' || newData.val() == 'admin' || newData.val() == 'manager') && !data.exists()"
          },
          "department": {
            ".validate": "newData.isString() && newData.val().length <= 100"
          },
          "isActive": {
            ".validate": "newData.isBoolean()"
          }
        },

        "metadata": {
          "createdAt": {
            ".validate": "newData.isString() && !data.exists()"
          },
          "lastLogin": {
            ".validate": "newData.isString()"
          },
          "loginCount": {
            ".validate": "newData.isNumber() && newData.val() >= 0"
          }
        }
      }
    },

    "pessoas": {
      ".read": "auth != null &&
               auth.token.email_verified == true &&
               root.child('users').child(auth.uid).child('profile').child('isActive').val() == true",

      ".write": "auth != null &&
                auth.token.email_verified == true &&
                root.child('users').child(auth.uid).child('profile').child('isActive').val() == true &&
                (root.child('users').child(auth.uid).child('profile').child('role').val() == 'admin' ||
                 root.child('users').child(auth.uid).child('profile').child('role').val() == 'manager')",

      "$pessoaId": {
        ".validate": "newData.hasChildren(['dados', 'metadata']) &&
                     newData.child('dados').hasChildren(['nome', 'telefone']) &&
                     newData.child('metadata').hasChildren(['createdAt', 'createdBy'])",

        "dados": {
          "nome": {
            ".validate": "newData.isString() && newData.val().length >= 2 && newData.val().length <= 100"
          },
          "telefone": {
            ".validate": "newData.isString() && newData.val().matches(/^\\([0-9]{2}\\) [0-9]{4,5}-[0-9]{4}$/)"
          },
          "email": {
            ".validate": "!newData.exists() || (newData.isString() && newData.val().matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/))"
          },
          "salario": {
            ".validate": "!newData.exists() || (newData.isNumber() && newData.val() >= 1320 && newData.val() <= 50000)"
          },
          "dataInicio": {
            ".validate": "newData.isString() && newData.val().matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)"
          },
          "endereco": {
            ".validate": "!newData.exists() || (newData.isString() && newData.val().length <= 200)"
          },
          "tipoContrato": {
            ".validate": "!newData.exists() || (newData.isString() && (newData.val() == 'CLT' || newData.val() == 'Terceirizado' || newData.val() == 'Comissionado'))"
          }
        },

        "metadata": {
          "createdAt": {
            ".validate": "newData.isString() && (!data.exists() || data.val() == newData.val())"
          },
          "updatedAt": {
            ".validate": "newData.isString()"
          },
          "createdBy": {
            ".validate": "newData.isString() && newData.val() == auth.uid && (!data.exists() || data.val() == newData.val())"
          },
          "updatedBy": {
            ".validate": "newData.isString() && newData.val() == auth.uid"
          },
          "version": {
            ".validate": "newData.isNumber() && newData.val() >= 1"
          }
        }
      }
    },

    "indicantes": {
      ".read": "auth != null && auth.token.email_verified == true",
      ".write": "auth != null &&
                auth.token.email_verified == true &&
                (root.child('users').child(auth.uid).child('profile').child('role').val() == 'admin' ||
                 root.child('users').child(auth.uid).child('profile').child('role').val() == 'manager')"
    },

    "secretarias": {
      ".read": "auth != null && auth.token.email_verified == true",
      ".write": "auth != null &&
                auth.token.email_verified == true &&
                root.child('users').child(auth.uid).child('profile').child('role').val() == 'admin'"
    },

    "system": {
      "stats": {
        ".read": "auth != null &&
                 (root.child('users').child(auth.uid).child('profile').child('role').val() == 'admin' ||
                  root.child('users').child(auth.uid).child('profile').child('role').val() == 'manager')",
        ".write": false
      },

      "audit": {
        ".read": "auth != null && root.child('users').child(auth.uid).child('profile').child('role').val() == 'admin'",
        ".write": false,

        "$year": {
          "$month": {
            "$logId": {
              ".validate": "newData.hasChildren(['action', 'userId', 'timestamp', 'resource', 'details']) &&
                           newData.child('userId').val() == auth.uid &&
                           newData.child('timestamp').isString() &&
                           newData.child('action').isString() &&
                           newData.child('resource').isString()"
            }
          }
        }
      }
    }
  }
}
```

## 🛠️ Implementação no Código

Para usar as regras com roles, você precisará criar um sistema de usuários:

### 1. Criar Interface de Usuário

```typescript
// src/app/shared/models/user.model.ts
export interface IUser {
  uid: string;
  email: string;
  displayName?: string;
  role: 'user' | 'admin' | 'manager';
  department?: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
  loginCount?: number;
}

export interface IUserProfile {
  email: string;
  displayName?: string;
  role: 'user' | 'admin' | 'manager';
  department?: string;
  isActive: boolean;
}

export interface IUserMetadata {
  createdAt: string;
  lastLogin?: string;
  loginCount?: number;
}
```

### 2. Serviço de Usuários

```typescript
// src/app/shared/services/user-service/user.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { FirebaseService } from '../firebase-service/firebase.service';
import { IUser } from '../../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private currentUserRoleSubject = new BehaviorSubject<string>('user');

  constructor(private firebaseService: FirebaseService) {}

  async createUserProfile(user: any): Promise<void> {
    const userProfile: IUser = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || '',
      role: 'user', // Papel padrão
      isActive: true,
      createdAt: new Date().toISOString(),
      loginCount: 1,
    };

    await this.firebaseService.setUserProfile(user.uid, userProfile);
  }

  async getUserRole(uid: string): Promise<string> {
    const userProfile = await this.firebaseService.getUserProfile(uid);
    return userProfile?.role || 'user';
  }

  isAdmin(): boolean {
    return this.currentUserRoleSubject.value === 'admin';
  }

  isManager(): boolean {
    return ['admin', 'manager'].includes(this.currentUserRoleSubject.value);
  }
}
```

### 3. Guard Atualizado

```typescript
// src/app/shared/guards/role/role.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot } from '@angular/router';
import { UserService } from '../../services/user-service/user.service';

@Injectable({
  providedIn: 'root',
})
export class RoleGuard implements CanActivate {
  constructor(private userService: UserService) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const requiredRoles = route.data['roles'] as string[];

    if (!requiredRoles) {
      return true;
    }

    return requiredRoles.some(role => {
      switch (role) {
        case 'admin':
          return this.userService.isAdmin();
        case 'manager':
          return this.userService.isManager();
        default:
          return true;
      }
    });
  }
}
```

## 🎯 Recomendações de Implementação

### Fase 1 - Implementação Imediata

```json
{
  "rules": {
    ".read": "auth != null && auth.token.email_verified == true",
    ".write": "auth != null && auth.token.email_verified == true",

    "pessoas": {
      "$pessoaId": {
        ".validate": "newData.hasChildren(['nome', 'telefone', 'createdAt']) &&
                     newData.child('nome').isString() &&
                     newData.child('nome').val().length > 2"
      }
    }
  }
}
```

### Fase 2 - Sistema de Roles (Futuro)

- Implementar as regras da **Versão 2**
- Criar sistema de usuários
- Adicionar controle de permissões

### Fase 3 - Auditoria Completa (Avançado)

- Implementar as regras da **Versão 3**
- Sistema de logs de auditoria
- Monitoramento de segurança

## 🔍 Benefícios das Novas Regras

### ✅ Segurança Aprimorada

- Validação de email verificado
- Controle de acesso granular
- Validação de dados de entrada
- Prevenção de campos inválidos

### ✅ Integridade dos Dados

- Validação de tipos de dados
- Controle de tamanho de strings
- Validação de formato (telefone, email)
- Campos obrigatórios

### ✅ Auditoria e Rastreabilidade

- Controle de quem criou/editou
- Timestamps de criação/atualização
- Logs de ações (versão avançada)
- Versionamento de dados

### ✅ Controle de Acesso

- Diferentes níveis de usuário
- Permissões específicas por recurso
- Bloqueio de usuários inativos
- Controle de departamentos

## 🚨 Considerações de Segurança

1. **Email Verificado**: Sempre exija `auth.token.email_verified == true`
2. **Validação de Entrada**: Valide TODOS os campos de entrada
3. **Princípio do Menor Privilégio**: Dê apenas as permissões necessárias
4. **Auditoria**: Mantenha logs de todas as ações importantes
5. **Backup Regular**: Faça backup dos dados críticos
6. **Monitoramento**: Configure alertas para ações suspeitas

Escolha a versão das regras que melhor se adequa à sua necessidade atual e evolua gradualmente!
