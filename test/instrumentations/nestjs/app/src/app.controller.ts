import { Controller, Get } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { HttpService } from '@nestjs/axios';

@Controller()
export class AppController {
  constructor(private readonly httpService: HttpService) {}

  @Get()
  async getHello(): Promise<string> {
    const response: AxiosResponse = await this.httpService.get('https://jsonplaceholder.typicode.com/posts/1').toPromise();
    return response.data;
  }

  @Get('quit')
  quit(): string {
    return 'ok';
  }
}
