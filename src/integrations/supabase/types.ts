export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cartoes_lancamentos: {
        Row: {
          ativo: boolean
          cartao: string
          categoria: string
          competencia: string
          consolidado: boolean
          created_at: string
          data_compra: string | null
          data_efetiva: string | null
          descricao: string
          fatura: string
          id: string
          origem: string
          parcela_num: number
          parcela_total: number
          parent_id: string | null
          status: string
          status_conciliacao: string
          user_id: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          cartao?: string
          categoria?: string
          competencia: string
          consolidado?: boolean
          created_at?: string
          data_compra?: string | null
          data_efetiva?: string | null
          descricao: string
          fatura?: string
          id?: string
          origem?: string
          parcela_num?: number
          parcela_total?: number
          parent_id?: string | null
          status?: string
          status_conciliacao?: string
          user_id: string
          valor: number
        }
        Update: {
          ativo?: boolean
          cartao?: string
          categoria?: string
          competencia?: string
          consolidado?: boolean
          created_at?: string
          data_compra?: string | null
          data_efetiva?: string | null
          descricao?: string
          fatura?: string
          id?: string
          origem?: string
          parcela_num?: number
          parcela_total?: number
          parent_id?: string | null
          status?: string
          status_conciliacao?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_lancamentos_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cartoes_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes_registry: {
        Row: {
          banco: string | null
          conta_pagamento_id: string | null
          created_at: string
          dia_fechamento: number
          dia_vencimento: number | null
          id: string
          limite: number
          nome: string
          user_id: string
        }
        Insert: {
          banco?: string | null
          conta_pagamento_id?: string | null
          created_at?: string
          dia_fechamento?: number
          dia_vencimento?: number | null
          id?: string
          limite?: number
          nome: string
          user_id: string
        }
        Update: {
          banco?: string | null
          conta_pagamento_id?: string | null
          created_at?: string
          dia_fechamento?: number
          dia_vencimento?: number | null
          id?: string
          limite?: number
          nome?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_registry_conta_pagamento_id_fkey"
            columns: ["conta_pagamento_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          message_id: string
          parts: Json
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          parts?: Json
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          parts?: Json
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      consignados_contratos: {
        Row: {
          ativo: boolean
          banco: string | null
          created_at: string
          data_inicio: string
          id: string
          nome: string
          parcela_atual: number
          saldo_devedor: number
          taxa_juros_mensal: number | null
          total_parcelas: number
          ultimo_avanco: string | null
          user_id: string
          valor_parcela: number
        }
        Insert: {
          ativo?: boolean
          banco?: string | null
          created_at?: string
          data_inicio?: string
          id?: string
          nome: string
          parcela_atual?: number
          saldo_devedor: number
          taxa_juros_mensal?: number | null
          total_parcelas: number
          ultimo_avanco?: string | null
          user_id: string
          valor_parcela: number
        }
        Update: {
          ativo?: boolean
          banco?: string | null
          created_at?: string
          data_inicio?: string
          id?: string
          nome?: string
          parcela_atual?: number
          saldo_devedor?: number
          taxa_juros_mensal?: number | null
          total_parcelas?: number
          ultimo_avanco?: string | null
          user_id?: string
          valor_parcela?: number
        }
        Relationships: []
      }
      consignados_eventos: {
        Row: {
          competencia: string
          contrato_id: string
          created_at: string
          despesa_id: string | null
          id: string
          juros_salvos: number
          parcelas_abatidas: number
          reducao_bruta: number
          tipo: string
          user_id: string
          valor_extra: number
        }
        Insert: {
          competencia: string
          contrato_id: string
          created_at?: string
          despesa_id?: string | null
          id?: string
          juros_salvos?: number
          parcelas_abatidas?: number
          reducao_bruta?: number
          tipo: string
          user_id: string
          valor_extra?: number
        }
        Update: {
          competencia?: string
          contrato_id?: string
          created_at?: string
          despesa_id?: string | null
          id?: string
          juros_salvos?: number
          parcelas_abatidas?: number
          reducao_bruta?: number
          tipo?: string
          user_id?: string
          valor_extra?: number
        }
        Relationships: [
          {
            foreignKeyName: "consignados_eventos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "consignados_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contas: {
        Row: {
          ativa: boolean
          created_at: string
          data_saldo_banco: string | null
          data_saldo_inicial: string
          id: string
          instituicao: string | null
          nome: string
          observacoes: string | null
          saldo_banco: number | null
          saldo_inicial: number
          tipo: string
          ultima_conciliacao: string | null
          ultima_conferencia: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          data_saldo_banco?: string | null
          data_saldo_inicial?: string
          id?: string
          instituicao?: string | null
          nome: string
          observacoes?: string | null
          saldo_banco?: number | null
          saldo_inicial?: number
          tipo?: string
          ultima_conciliacao?: string | null
          ultima_conferencia?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          data_saldo_banco?: string | null
          data_saldo_inicial?: string
          id?: string
          instituicao?: string | null
          nome?: string
          observacoes?: string | null
          saldo_banco?: number | null
          saldo_inicial?: number
          tipo?: string
          ultima_conciliacao?: string | null
          ultima_conferencia?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      despesas: {
        Row: {
          categoria: string
          competencia: string
          conta_id: string | null
          created_at: string
          data_efetiva: string | null
          data_venc: string
          descricao: string
          id: string
          origem: string
          recorrente: boolean
          status: string
          status_conciliacao: string
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          categoria?: string
          competencia: string
          conta_id?: string | null
          created_at?: string
          data_efetiva?: string | null
          data_venc: string
          descricao: string
          id?: string
          origem?: string
          recorrente?: boolean
          status?: string
          status_conciliacao?: string
          tipo?: string
          user_id: string
          valor: number
        }
        Update: {
          categoria?: string
          competencia?: string
          conta_id?: string | null
          created_at?: string
          data_efetiva?: string | null
          data_venc?: string
          descricao?: string
          id?: string
          origem?: string
          recorrente?: boolean
          status?: string
          status_conciliacao?: string
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
        ]
      }
      insumos: {
        Row: {
          competencia: string
          created_at: string
          data_final_consumo: string | null
          dias_alerta: number
          id: string
          nome: string
          observacao: string | null
          updated_at: string
          user_id: string
          validade: string | null
          valor_base: number
        }
        Insert: {
          competencia: string
          created_at?: string
          data_final_consumo?: string | null
          dias_alerta?: number
          id?: string
          nome: string
          observacao?: string | null
          updated_at?: string
          user_id: string
          validade?: string | null
          valor_base?: number
        }
        Update: {
          competencia?: string
          created_at?: string
          data_final_consumo?: string | null
          dias_alerta?: number
          id?: string
          nome?: string
          observacao?: string | null
          updated_at?: string
          user_id?: string
          validade?: string | null
          valor_base?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          reserva_minima: number
          salario_base: number
          saldo_inicial: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          reserva_minima?: number
          salario_base?: number
          saldo_inicial?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          reserva_minima?: number
          salario_base?: number
          saldo_inicial?: number
          updated_at?: string
        }
        Relationships: []
      }
      receitas: {
        Row: {
          categoria: string
          competencia: string
          conta_id: string | null
          created_at: string
          data: string
          data_efetiva: string | null
          descricao: string
          id: string
          origem: string
          status: string
          status_conciliacao: string
          user_id: string
          valor: number
        }
        Insert: {
          categoria?: string
          competencia: string
          conta_id?: string | null
          created_at?: string
          data: string
          data_efetiva?: string | null
          descricao: string
          id?: string
          origem?: string
          status?: string
          status_conciliacao?: string
          user_id: string
          valor: number
        }
        Update: {
          categoria?: string
          competencia?: string
          conta_id?: string | null
          created_at?: string
          data?: string
          data_efetiva?: string | null
          descricao?: string
          id?: string
          origem?: string
          status?: string
          status_conciliacao?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "receitas_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
        ]
      }
      reservas: {
        Row: {
          banco: string | null
          competencia: string
          created_at: string
          id: string
          nome: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          banco?: string | null
          competencia?: string
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
          user_id: string
          valor?: number
        }
        Update: {
          banco?: string | null
          competencia?: string
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      saldos_mensais: {
        Row: {
          competencia: string
          created_at: string
          id: string
          saldo_inicial: number
          updated_at: string
          user_id: string
        }
        Insert: {
          competencia: string
          created_at?: string
          id?: string
          saldo_inicial?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          competencia?: string
          created_at?: string
          id?: string
          saldo_inicial?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vinculacao_log: {
        Row: {
          conta_anterior_id: string | null
          conta_anterior_nome: string | null
          conta_nova_id: string | null
          conta_nova_nome: string | null
          created_at: string
          descricao: string | null
          id: string
          lancamento_id: string
          tabela: string
          user_id: string
          valor: number | null
        }
        Insert: {
          conta_anterior_id?: string | null
          conta_anterior_nome?: string | null
          conta_nova_id?: string | null
          conta_nova_nome?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          lancamento_id: string
          tabela: string
          user_id: string
          valor?: number | null
        }
        Update: {
          conta_anterior_id?: string | null
          conta_anterior_nome?: string | null
          conta_nova_id?: string | null
          conta_nova_nome?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          lancamento_id?: string
          tabela?: string
          user_id?: string
          valor?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
