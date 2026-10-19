import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { extractVisitorInfo } from '../utils/Visitor-info.util';

@Injectable()
export class VisitorTracingMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) { }
  async use(req: Request, res: Response, next: NextFunction) {
    
    if(req.path.startsWith('/public') || req.path ==='/favicon.ico') return next()
    
      let visitorId = req.headers['x-visitor-id'] || req.cookies?.['visitor_id'];

      if(!visitorId){
        visitorId = randomUUID();

        res.cookie('visitor_id', visitorId, {
          maxAge:365*24*60*60*1000,
          httpOnly:false,
          sameSite:'lax',
        })
      }
      req['visitorId'] = visitorId;

      const info = extractVisitorInfo(req);
      const country = info.country || 'Unknown';
      const city = info.city || 'Unknown';
      const timezone = info.timezone || 'UTC';

      const userAgent=req.headers['user-agent']||'Unknown';

      this.prisma.visitor.upsert({
        where:{id:visitorId},
        update:{
          lastSeenAt:new Date(),
          ipAddress:info.ip,
          country,
          city,
          timezone,
          deviceInfo:info.deviceInfo as any,
          totalVisits:{increment:1}
        },
        create:{
          id:visitorId,
          ipAddress:info.ip,
          deviceInfo:info.deviceInfo as any,
          country,
          city,
          timezone,
          firstSeenAt:new Date(),
          lastSeenAt:new Date(),
        }
      }).then(()=>{
        return this.prisma.pageView.create({
          data:{
            visitorId,
            path:req.originalUrl||req.path,
          }
        })
      }).catch((err)=>{
        console.error('Visitor tracking error:', err.message)
      })

    next();
  }
}
