import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Room } from './room.entity';
import { User } from './user.entity';
import { RoomPlayer } from './room-player.entity';
import { ScoreLogType } from './enums';

@Entity('score_logs')
export class ScoreLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'room_id', type: 'uuid' })
  roomId: string;

  @ManyToOne(() => Room, (room) => room.scoreLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @Column({ name: 'operator_id', type: 'uuid' })
  operatorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'operator_id' })
  operator: User;

  @Column({ name: 'from_player_id', type: 'uuid' })
  fromPlayerId: string;

  @ManyToOne(() => RoomPlayer, (rp) => rp.scoreLogsFrom, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'from_player_id' })
  fromPlayer: RoomPlayer;

  @Column({ name: 'to_player_id', type: 'uuid' })
  toPlayerId: string;

  @ManyToOne(() => RoomPlayer, (rp) => rp.scoreLogsTo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'to_player_id' })
  toPlayer: RoomPlayer;

  @Column({ type: 'int' })
  amount: number;

  @Column({
    type: 'enum',
    enum: ScoreLogType,
  })
  type: ScoreLogType;

  @Column({ name: 'is_revoked', type: 'boolean', default: false })
  isRevoked: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
