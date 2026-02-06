export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  config: {
    Tables: {
      cross_domain_rules: {
        Row: {
          created_at: string
          description: string | null
          id: number
          repo_full_name: string
          required_domains: string[]
          rule_pattern: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          repo_full_name: string
          required_domains: string[]
          rule_pattern: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          repo_full_name?: string
          required_domains?: string[]
          rule_pattern?: string
        }
        Relationships: [
          {
            foreignKeyName: "cross_domain_rules_repo_full_name_fkey"
            columns: ["repo_full_name"]
            isOneToOne: false
            referencedRelation: "repository_config"
            referencedColumns: ["repo_full_name"]
          },
        ]
      }
      domain_owners: {
        Row: {
          added_at: string
          added_by: string | null
          domain_id: string
          email: string
          name: string | null
          role: string | null
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          domain_id: string
          email: string
          name?: string | null
          role?: string | null
        }
        Update: {
          added_at?: string
          added_by?: string | null
          domain_id?: string
          email?: string
          name?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "domain_owners_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_scope: {
        Row: {
          domain_id: string
          scope_item: string
          sort_order: number | null
        }
        Insert: {
          domain_id: string
          scope_item: string
          sort_order?: number | null
        }
        Update: {
          domain_id?: string
          scope_item?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "domain_scope_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      domains: {
        Row: {
          contact_email: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          teams_channel: string | null
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          description?: string | null
          id: string
          name: string
          teams_channel?: string | null
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          teams_channel?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      repository_config: {
        Row: {
          approval_required: boolean
          auto_merge_after_hours: number | null
          auto_merge_enabled: boolean
          config_file_path: string
          config_sha: string | null
          created_at: string
          document_path: string
          document_type: string
          domain_approval: boolean
          escalate_after_hours: number | null
          notification_channels: string[] | null
          notify_on_pr_open: boolean
          owner_approval: boolean
          reminder_after_hours: number | null
          repo_full_name: string
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          approval_required?: boolean
          auto_merge_after_hours?: number | null
          auto_merge_enabled?: boolean
          config_file_path?: string
          config_sha?: string | null
          created_at?: string
          document_path: string
          document_type: string
          domain_approval?: boolean
          escalate_after_hours?: number | null
          notification_channels?: string[] | null
          notify_on_pr_open?: boolean
          owner_approval?: boolean
          reminder_after_hours?: number | null
          repo_full_name: string
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          approval_required?: boolean
          auto_merge_after_hours?: number | null
          auto_merge_enabled?: boolean
          config_file_path?: string
          config_sha?: string | null
          created_at?: string
          document_path?: string
          document_type?: string
          domain_approval?: boolean
          escalate_after_hours?: number | null
          notification_channels?: string[] | null
          notify_on_pr_open?: boolean
          owner_approval?: boolean
          reminder_after_hours?: number | null
          repo_full_name?: string
          synced_at?: string | null
          updated_at?: string
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
  mastra_store: {
    Tables: {
      mastra_agent_versions: {
        Row: {
          agentId: string
          agents: Json | null
          changedFields: Json | null
          changeMessage: string | null
          createdAt: string
          createdAtZ: string | null
          defaultOptions: Json | null
          description: string | null
          id: string
          inputProcessors: Json | null
          instructions: string
          integrationTools: Json | null
          memory: Json | null
          model: Json
          name: string
          outputProcessors: Json | null
          scorers: Json | null
          tools: Json | null
          versionNumber: number
          workflows: Json | null
        }
        Insert: {
          agentId: string
          agents?: Json | null
          changedFields?: Json | null
          changeMessage?: string | null
          createdAt: string
          createdAtZ?: string | null
          defaultOptions?: Json | null
          description?: string | null
          id: string
          inputProcessors?: Json | null
          instructions: string
          integrationTools?: Json | null
          memory?: Json | null
          model: Json
          name: string
          outputProcessors?: Json | null
          scorers?: Json | null
          tools?: Json | null
          versionNumber: number
          workflows?: Json | null
        }
        Update: {
          agentId?: string
          agents?: Json | null
          changedFields?: Json | null
          changeMessage?: string | null
          createdAt?: string
          createdAtZ?: string | null
          defaultOptions?: Json | null
          description?: string | null
          id?: string
          inputProcessors?: Json | null
          instructions?: string
          integrationTools?: Json | null
          memory?: Json | null
          model?: Json
          name?: string
          outputProcessors?: Json | null
          scorers?: Json | null
          tools?: Json | null
          versionNumber?: number
          workflows?: Json | null
        }
        Relationships: []
      }
      mastra_agents: {
        Row: {
          activeVersionId: string | null
          authorId: string | null
          createdAt: string
          createdAtZ: string | null
          id: string
          metadata: Json | null
          status: string
          updatedAt: string
          updatedAtZ: string | null
        }
        Insert: {
          activeVersionId?: string | null
          authorId?: string | null
          createdAt: string
          createdAtZ?: string | null
          id: string
          metadata?: Json | null
          status: string
          updatedAt: string
          updatedAtZ?: string | null
        }
        Update: {
          activeVersionId?: string | null
          authorId?: string | null
          createdAt?: string
          createdAtZ?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          updatedAt?: string
          updatedAtZ?: string | null
        }
        Relationships: []
      }
      mastra_ai_spans: {
        Row: {
          attributes: Json | null
          createdAt: string
          createdAtZ: string | null
          endedAt: string | null
          endedAtZ: string | null
          entityId: string | null
          entityName: string | null
          entityType: string | null
          environment: string | null
          error: Json | null
          input: Json | null
          isEvent: boolean
          links: Json | null
          metadata: Json | null
          name: string
          organizationId: string | null
          output: Json | null
          parentSpanId: string | null
          requestId: string | null
          resourceId: string | null
          runId: string | null
          scope: Json | null
          serviceName: string | null
          sessionId: string | null
          source: string | null
          spanId: string
          spanType: string
          startedAt: string
          startedAtZ: string | null
          tags: Json | null
          threadId: string | null
          traceId: string
          updatedAt: string | null
          updatedAtZ: string | null
          userId: string | null
        }
        Insert: {
          attributes?: Json | null
          createdAt: string
          createdAtZ?: string | null
          endedAt?: string | null
          endedAtZ?: string | null
          entityId?: string | null
          entityName?: string | null
          entityType?: string | null
          environment?: string | null
          error?: Json | null
          input?: Json | null
          isEvent: boolean
          links?: Json | null
          metadata?: Json | null
          name: string
          organizationId?: string | null
          output?: Json | null
          parentSpanId?: string | null
          requestId?: string | null
          resourceId?: string | null
          runId?: string | null
          scope?: Json | null
          serviceName?: string | null
          sessionId?: string | null
          source?: string | null
          spanId: string
          spanType: string
          startedAt: string
          startedAtZ?: string | null
          tags?: Json | null
          threadId?: string | null
          traceId: string
          updatedAt?: string | null
          updatedAtZ?: string | null
          userId?: string | null
        }
        Update: {
          attributes?: Json | null
          createdAt?: string
          createdAtZ?: string | null
          endedAt?: string | null
          endedAtZ?: string | null
          entityId?: string | null
          entityName?: string | null
          entityType?: string | null
          environment?: string | null
          error?: Json | null
          input?: Json | null
          isEvent?: boolean
          links?: Json | null
          metadata?: Json | null
          name?: string
          organizationId?: string | null
          output?: Json | null
          parentSpanId?: string | null
          requestId?: string | null
          resourceId?: string | null
          runId?: string | null
          scope?: Json | null
          serviceName?: string | null
          sessionId?: string | null
          source?: string | null
          spanId?: string
          spanType?: string
          startedAt?: string
          startedAtZ?: string | null
          tags?: Json | null
          threadId?: string | null
          traceId?: string
          updatedAt?: string | null
          updatedAtZ?: string | null
          userId?: string | null
        }
        Relationships: []
      }
      mastra_messages: {
        Row: {
          content: string
          createdAt: string
          createdAtZ: string | null
          id: string
          resourceId: string | null
          role: string
          thread_id: string
          type: string
        }
        Insert: {
          content: string
          createdAt: string
          createdAtZ?: string | null
          id: string
          resourceId?: string | null
          role: string
          thread_id: string
          type: string
        }
        Update: {
          content?: string
          createdAt?: string
          createdAtZ?: string | null
          id?: string
          resourceId?: string | null
          role?: string
          thread_id?: string
          type?: string
        }
        Relationships: []
      }
      mastra_resources: {
        Row: {
          createdAt: string
          createdAtZ: string | null
          id: string
          metadata: Json | null
          updatedAt: string
          updatedAtZ: string | null
          workingMemory: string | null
        }
        Insert: {
          createdAt: string
          createdAtZ?: string | null
          id: string
          metadata?: Json | null
          updatedAt: string
          updatedAtZ?: string | null
          workingMemory?: string | null
        }
        Update: {
          createdAt?: string
          createdAtZ?: string | null
          id?: string
          metadata?: Json | null
          updatedAt?: string
          updatedAtZ?: string | null
          workingMemory?: string | null
        }
        Relationships: []
      }
      mastra_scorers: {
        Row: {
          additionalContext: Json | null
          analyzePrompt: string | null
          analyzeStepResult: Json | null
          createdAt: string
          createdAtZ: string | null
          entity: Json | null
          entityId: string | null
          entityType: string | null
          extractPrompt: string | null
          extractStepResult: Json | null
          generateReasonPrompt: string | null
          generateScorePrompt: string | null
          id: string
          input: Json
          metadata: Json | null
          output: Json
          preprocessPrompt: string | null
          preprocessStepResult: Json | null
          reason: string | null
          reasonPrompt: string | null
          requestContext: Json | null
          resourceId: string | null
          runId: string
          score: number
          scorer: Json
          scorerId: string
          source: string
          spanId: string | null
          threadId: string | null
          traceId: string | null
          updatedAt: string
          updatedAtZ: string | null
        }
        Insert: {
          additionalContext?: Json | null
          analyzePrompt?: string | null
          analyzeStepResult?: Json | null
          createdAt: string
          createdAtZ?: string | null
          entity?: Json | null
          entityId?: string | null
          entityType?: string | null
          extractPrompt?: string | null
          extractStepResult?: Json | null
          generateReasonPrompt?: string | null
          generateScorePrompt?: string | null
          id: string
          input: Json
          metadata?: Json | null
          output: Json
          preprocessPrompt?: string | null
          preprocessStepResult?: Json | null
          reason?: string | null
          reasonPrompt?: string | null
          requestContext?: Json | null
          resourceId?: string | null
          runId: string
          score: number
          scorer: Json
          scorerId: string
          source: string
          spanId?: string | null
          threadId?: string | null
          traceId?: string | null
          updatedAt: string
          updatedAtZ?: string | null
        }
        Update: {
          additionalContext?: Json | null
          analyzePrompt?: string | null
          analyzeStepResult?: Json | null
          createdAt?: string
          createdAtZ?: string | null
          entity?: Json | null
          entityId?: string | null
          entityType?: string | null
          extractPrompt?: string | null
          extractStepResult?: Json | null
          generateReasonPrompt?: string | null
          generateScorePrompt?: string | null
          id?: string
          input?: Json
          metadata?: Json | null
          output?: Json
          preprocessPrompt?: string | null
          preprocessStepResult?: Json | null
          reason?: string | null
          reasonPrompt?: string | null
          requestContext?: Json | null
          resourceId?: string | null
          runId?: string
          score?: number
          scorer?: Json
          scorerId?: string
          source?: string
          spanId?: string | null
          threadId?: string | null
          traceId?: string | null
          updatedAt?: string
          updatedAtZ?: string | null
        }
        Relationships: []
      }
      mastra_threads: {
        Row: {
          createdAt: string
          createdAtZ: string | null
          id: string
          metadata: Json | null
          resourceId: string
          title: string
          updatedAt: string
          updatedAtZ: string | null
        }
        Insert: {
          createdAt: string
          createdAtZ?: string | null
          id: string
          metadata?: Json | null
          resourceId: string
          title: string
          updatedAt: string
          updatedAtZ?: string | null
        }
        Update: {
          createdAt?: string
          createdAtZ?: string | null
          id?: string
          metadata?: Json | null
          resourceId?: string
          title?: string
          updatedAt?: string
          updatedAtZ?: string | null
        }
        Relationships: []
      }
      mastra_workflow_snapshot: {
        Row: {
          createdAt: string
          createdAtZ: string | null
          resourceId: string | null
          run_id: string
          snapshot: Json
          updatedAt: string
          updatedAtZ: string | null
          workflow_name: string
        }
        Insert: {
          createdAt: string
          createdAtZ?: string | null
          resourceId?: string | null
          run_id: string
          snapshot: Json
          updatedAt: string
          updatedAtZ?: string | null
          workflow_name: string
        }
        Update: {
          createdAt?: string
          createdAtZ?: string | null
          resourceId?: string | null
          run_id?: string
          snapshot?: Json
          updatedAt?: string
          updatedAtZ?: string | null
          workflow_name?: string
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  config: {
    Enums: {},
  },
  mastra_store: {
    Enums: {},
  },
} as const

