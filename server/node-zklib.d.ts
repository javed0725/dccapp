declare module "node-zklib" {
  interface AttendanceRecord {
    deviceUserId: string;
    uid?: number;
    userId?: string;
    attTime: Date;
    verifyMethod: number;
    inOutStatus: number;
  }

  interface ZKLibInstance {
    createSocket(): Promise<void>;
    getAttendances(): Promise<{ data: AttendanceRecord[] | { attendances: AttendanceRecord[] } }>;
    getInfo(): Promise<any>;
    disconnect(): Promise<void>;
  }

  interface ZKLibConstructor {
    new (ip: string, port: number, connectionType: "tcp" | "udp", timeout?: number): ZKLibInstance;
  }

  const ZKLib: ZKLibConstructor;
  export default ZKLib;
}
