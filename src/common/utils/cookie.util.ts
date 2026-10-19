import { Response } from "express";

export class CookieUtil {
    static setAuthCookies(res:Response, accessToken:string, refreshToken:string){
        const isProd = process.env.NODE_ENV === 'production';

        res.cookie('accessToken',accessToken,{
            httpOnly:true,
            secure:isProd,
            sameSite:'lax',
            maxAge:1000*60*60, // 1 day
        })

        res.cookie('refreshToken',refreshToken,{
            httpOnly:true,
            secure:isProd,
            sameSite:'lax',
            maxAge:1000*60*60*24*7 // 7 days
        })
    }

    static clearAuthCookies(res:Response){
        const isProd = process.env.NODE_ENV === 'production';
        res.clearCookie('accessToken', {
            httpOnly:true,
            secure:isProd,
            sameSite:'lax'
        })

        res.clearCookie('refreshToken', {
            httpOnly:true,
            secure:isProd,
            sameSite:'lax'
        })
    }
}