import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Room } from './room.entity';
import { User } from './user.entity';
import { ScoreLog } from './score-log.entity';

@Entity('room_players')
export class RoomPlayer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'room_id', type: 'uuid' })
  roomId: string;

  @ManyToOne(() => Room, (room) => room.players, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'is_virtual', type: 'boolean', default: false })
  isVirtual: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  alias: string | null;

  @Column({ type: 'smallint' })
  position: number;

  @Column({ name: 'initial_score', type: 'int', default: 0 })
  initialScore: number;

  @Column({ name: 'current_score', type: 'int', default: 0 })
  currentScore: number;

  @OneToMany(() => ScoreLog, (log) => log.fromPlayer)
  scoreLogsFrom: ScoreLog[];

  @OneToMany(() => ScoreLog, (log) => log.toPlayer)
  scoreLogsTo: ScoreLog[];
}
