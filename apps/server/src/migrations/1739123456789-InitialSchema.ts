import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1739123456789 implements MigrationInterface {
  name = 'InitialSchema1739123456789';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "rooms_status_enum" AS ENUM ('waiting', 'playing', 'finished');
    `);
    await queryRunner.query(`
      CREATE TYPE "score_logs_type_enum" AS ENUM ('normal', 'all_in', 'undo');
    `);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "openid" varchar(255) NOT NULL,
        "nickname" varchar(255),
        "avatar_url" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_openid" UNIQUE ("openid"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_users_openid" ON "users" ("openid");`);
    await queryRunner.query(`
      CREATE TABLE "rooms" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "room_code" varchar(6) NOT NULL,
        "owner_id" uuid NOT NULL,
        "status" "rooms_status_enum" NOT NULL DEFAULT 'waiting',
        "config" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_rooms_room_code" UNIQUE ("room_code"),
        CONSTRAINT "PK_rooms" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rooms_owner" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_rooms_room_code" ON "rooms" ("room_code");`);
    await queryRunner.query(`
      CREATE TABLE "room_players" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "room_id" uuid NOT NULL,
        "user_id" uuid,
        "is_virtual" boolean NOT NULL DEFAULT false,
        "alias" varchar(255),
        "position" smallint NOT NULL,
        "initial_score" int NOT NULL DEFAULT 0,
        "current_score" int NOT NULL DEFAULT 0,
        CONSTRAINT "PK_room_players" PRIMARY KEY ("id"),
        CONSTRAINT "FK_room_players_room" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_room_players_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
      );
    `);
    await queryRunner.query(`CREATE INDEX "IDX_room_players_room_id" ON "room_players" ("room_id");`);
    await queryRunner.query(`
      CREATE TABLE "score_logs" (
        "id" bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
        "room_id" uuid NOT NULL,
        "operator_id" uuid NOT NULL,
        "from_player_id" uuid NOT NULL,
        "to_player_id" uuid NOT NULL,
        "amount" int NOT NULL,
        "type" "score_logs_type_enum" NOT NULL,
        "is_revoked" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_score_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_score_logs_room" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_score_logs_operator" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_score_logs_from_player" FOREIGN KEY ("from_player_id") REFERENCES "room_players"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_score_logs_to_player" FOREIGN KEY ("to_player_id") REFERENCES "room_players"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_score_logs_room_created" ON "score_logs" ("room_id", "created_at");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_score_logs_room_created";`);
    await queryRunner.query(`DROP TABLE "score_logs";`);
    await queryRunner.query(`DROP INDEX "IDX_room_players_room_id";`);
    await queryRunner.query(`DROP TABLE "room_players";`);
    await queryRunner.query(`DROP INDEX "IDX_rooms_room_code";`);
    await queryRunner.query(`DROP TABLE "rooms";`);
    await queryRunner.query(`DROP INDEX "IDX_users_openid";`);
    await queryRunner.query(`DROP TABLE "users";`);
    await queryRunner.query(`DROP TYPE "score_logs_type_enum";`);
    await queryRunner.query(`DROP TYPE "rooms_status_enum";`);
  }
}
