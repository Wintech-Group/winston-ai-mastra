-- INitialise schema for winston-ai mastra server

CREATE SCHEMA "mastra_winston_ai";

GRANT USAGE ON SCHEMA "mastra_winston_ai" TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA "mastra_winston_ai" TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA "mastra_winston_ai" TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA "mastra_winston_ai" TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA "mastra_winston_ai" GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA "mastra_winston_ai" GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA "mastra_winston_ai" GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;