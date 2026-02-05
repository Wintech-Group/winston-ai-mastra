-- INitialise schema for winston-ai mastra server

CREATE SCHEMA "mastra_store";

GRANT USAGE ON SCHEMA "mastra_store" TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA "mastra_store" TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA "mastra_store" TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA "mastra_store" TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA "mastra_store" GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA "mastra_store" GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA "mastra_store" GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;