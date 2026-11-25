import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Universal search across guides, species, breeds, and authors',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Search keyword',
    type: String,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Max guides to return (default: 5)',
    type: Number,
  })
  search(@Query('q') query: string, @Query('limit') limit?: number) {
    return this.searchService.search(query, limit);
  }
}
