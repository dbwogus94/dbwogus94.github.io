import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import moment from 'moment';
import * as path from 'path';
import * as fs from 'fs';
// import * as fsPromise from 'fs/promises';
import axios from 'axios';

/**
 * 코드 블록 이스케이프
 * @param {string} body
 * @returns {string}
 */
const escapeCodeBlock = (body) => {
  const regex = /```([\s\S]*?)```/g;
  return body.replace(regex, (_, codeBlock) => {
    if (codeBlock.trim().startsWith('mermaid')) {
      // mermaid 코드 블록은 raw 태그를 사용하지 않음
      return '\n```' + codeBlock.trim() + '\n```\n';
    }
    return '\n{% raw %}\n```' + codeBlock.trim() + '\n```\n{% endraw %}\n';
  });
};

/**
 * 노션 아티클 타이틀 치환
 * @param {string} body
 * @returns {string}
 */
const replaceTitleOutsideRawBlocks = (body: string) => {
  const rawBlocks = [];
  const placeholder = '%%RAW_BLOCK%%';
  body = body.replace(/{% raw %}[\s\S]*?{% endraw %}/g, (match) => {
    rawBlocks.push(match);
    return placeholder;
  });

  const regex = /\n#[^\n]+\n/g;
  body = body.replace(regex, function (match) {
    return '\n' + match.replace('\n#', '\n##');
  });

  rawBlocks.forEach((block) => {
    body = body.replace(placeholder, block);
  });

  return body;
};

/**
 * 노션 내부 링크 URL 변환
 * @param {string} body
 * @returns {string}
 */
const replaceNotionInternalLinks = (body: string) => {
  // 마크다운 링크 패턴: [텍스트](/로 시작하는 URL)
  const regex = /\[(.*?)\]\(\/([a-zA-Z0-9]{32})\)/g;
  return body.replace(regex, (_, text, pageId) => {
    return `[${text}](https://www.notion.so/${pageId})`;
  });
};

/**
 * 스트림으로 이미지 다운로드
 * @param url
 * @param filename
 */
const downloadImage = async (url: string, filename: string) => {
  await axios({
    method: 'get',
    url: url,
    responseType: 'stream',
  })
    .then((response) => {
      return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filename);
        response.data.pipe(file);
        file.on('finish', () => resolve(filename));
        file.on('error', reject);
        file.on('close', () => resolve(filename));
      });
    })
    .catch((error) => {
      throw new Error(`다운로드 실패: ${error.message}`);
    });
};

const env = {
  NOTION_TOKEN: process.env.NOTION_TOKEN ?? '',
  DATABASE_ID: process.env.DATABASE_ID ?? '',
};
// passing notion client to the option
const notion = new Client({
  auth: env.NOTION_TOKEN,
});
const n2m = new NotionToMarkdown({ notionClient: notion });

const runProcess = async () => {
  // ensure directory exists
  const root = '_posts';
  fs.mkdirSync(root, { recursive: true });

  const databaseId = env.DATABASE_ID;
  let response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: '공개',
      checkbox: {
        equals: true,
      },
      // property: '게시물',
      // title: {
      //   equals: '[프로젝트 | 똑소] 3. 프로젝트 초기 셋팅 - 보일러플레이드',
      // },
    },
  });

  const pages = response.results;
  while (response.has_more) {
    const nextCursor = response.next_cursor;
    response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: nextCursor,
      filter: {
        property: '공개',
        checkbox: {
          equals: true,
        },
      },
    });
    pages.push(...response.results);
  }

  /**
   * 1. jekyll에 적용할 frontmatter 생성하기
   * 2. 노션 아티클 markdown으로 변환하기
   * 3. 노션 아티클에 포함된 이미지 다운로드 하기
   * 4. 노션 아티클 markdown 파일로 생성하기
   */
  for (const i in pages) {
    /* 1. jekyll에 적용할 frontmatter 생성하기 */
    const r = pages[i] as any;
    const id = r.id;

    // date
    let date = moment(r.created_time).format('YYYY-MM-DD');
    const pdate = r.properties?.['날짜']?.['date']?.['start'];
    if (pdate) {
      date = moment(pdate).format('YYYY-MM-DD');
    }

    let title = id;
    const titles = [];
    const ptitle = r.properties?.['게시물']?.['title'];
    if (ptitle?.length > 0) {
      for (const t of ptitle) {
        const n = t?.['plain_text'];
        if (n) titles.push(n);
      }
      title = titles.join('');
    }

    // tags
    const tags = [];
    const ptags = r.properties?.['태그']?.['multi_select'];
    for (const t of ptags) {
      const n = t?.['name'];
      if (n) tags.push(n);
    }
    // categories
    const cats = [];
    const pcats = r.properties?.['카테고리']?.['multi_select'];
    for (const t of pcats) {
      const n = t?.['name'];
      if (n) cats.push(n);
    }

    // frontmatter
    let fmtags = '';
    let fmcats = '';
    if (tags.length > 0) {
      fmtags += '\ntags: [';
      for (const t of tags) {
        fmtags += t + ', ';
      }
      fmtags += ']';
    }
    if (cats.length > 0) {
      fmcats += '\ncategories: [';
      for (const t of cats) {
        fmcats += t + ', ';
      }
      fmcats += ']';
    }
    const fm = `---
layout: post
date: ${date}
title: "${title}"${fmtags}${fmcats}
mermaid: true
---

`;

    /* 2. 노션 아티클 markdown으로 변환 */
    const mdblocks = await n2m.pageToMarkdown(id);
    let md = n2m.toMarkdownString(mdblocks)['parent'];
    if (md === '' || md == null) {
      continue;
    }
    md = escapeCodeBlock(md); // 코드 블록 이스케이프
    md = replaceTitleOutsideRawBlocks(md); // 타이틀 치환: H1 -> H2
    md = replaceNotionInternalLinks(md); // 노션 내부 링크 URL 변환

    // 노션 아티클 title to 마크다운 파일명
    const ftitle = `${date}-${title.replaceAll(' ', '-')}.md`;

    /** 마크다운에서 문제가 될 수 있는 특수문자: [], (), |, ?, !, @, #, $, %, ^, &, *, +, =, ;, :, ", ', <, >, , */
    const INVALID_FILENAME_CHARS =
      /[\[\]\(\)\|\?\!\@\#\$\%\^\&\*\+\=\;\:\"\'\<\>\,]/g;
    const imagePrefix = ftitle.replace(INVALID_FILENAME_CHARS, '');

    /* 3. 노션 아티클에 포함된 이미지 다운로드 로직 */
    let index = 0;
    const downloadPromises = [];
    // 이미지 markdown regex
    const IMAGE_MARKDOWN_REGEX = /!\[(.*?)\]\((.*?)\)/g;
    // 이미지 markdown 치환하면서 이미지 다운로드 요청목록 생성
    const edited_md = md.replace(IMAGE_MARKDOWN_REGEX, (_, p1, p2) => {
      const dirname = path.join('assets/img', imagePrefix);
      // 디렉토리 생성
      if (!fs.existsSync(dirname)) fs.mkdirSync(dirname, { recursive: true });
      // 이미지 파일명
      const imgFilename = path.join(dirname, `${index}.png`);
      // 이미지 다운로드 시작하고 프로미스 배열에 추가
      downloadPromises.push(downloadImage(p2, imgFilename));

      const res = p1 === '' ? '' : `_${p1}_`;
      // 이미지 markdown 치환, EX. ![1](/assets/img/2024-01-01-title/1.png)
      return `![${index++}](/${imgFilename})${res}`;
    });
    // 모든 이미지 다운로드 완료 기다린다.
    const res = await Promise.allSettled(downloadPromises);
    // 결과 로깅
    console.log(`\n[${ftitle}] 이미지 다운로드 결과:`);
    const successful = res.filter((r) => r.status === 'fulfilled').length;
    const failed = res.filter((r) => r.status === 'rejected').length;
    console.log(
      `\n총 ${res.length}개 중 성공: ${successful}, 실패: ${failed}\n`,
    );

    /* 4. 노션 아티클 markdown 파일로 생성 */
    try {
      await fs.promises.writeFile(path.join(root, ftitle), fm + edited_md);
      console.log(`파일 저장 완료: ${ftitle}`);
    } catch (error) {
      console.error(`파일 저장 실패: ${ftitle}`, error);
    }
  }
};

const moveDirectories = async () => {
  // _posts 폴더 이동
  const sourcePostsDir = path.join(process.cwd(), '_posts');
  const targetPostsDir = path.join(process.cwd(), '../_posts');
  console.log(sourcePostsDir);
  console.log(targetPostsDir);

  // assets/img 폴더 이동
  const sourceImgDir = path.join(process.cwd(), 'assets/img');
  const targetImgDir = path.join(process.cwd(), '../assets/img');

  const copyDir = async (src: string, dest: string) => {
    // 대상 디렉토리가 없으면 생성
    if (!fs.existsSync(dest)) {
      await fs.promises.mkdir(dest, { recursive: true });
    }

    // 소스 디렉토리의 모든 파일 읽기
    const files = await fs.promises.readdir(src);

    // 모든 파일 복사 작업을 동시에 실행
    await Promise.all(
      files.map(async (file) => {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);

        const stats = await fs.promises.stat(srcPath);

        if (stats.isDirectory()) {
          // 디렉토리인 경우 재귀적으로 복사
          await copyDir(srcPath, destPath);
        } else {
          // 파일인 경우 복사
          await fs.promises.copyFile(srcPath, destPath);
        }
      }),
    );
  };

  try {
    // 폴더 복사 및 병합
    if (fs.existsSync(sourcePostsDir)) {
      await copyDir(sourcePostsDir, targetPostsDir);
      await fs.promises.rm(sourcePostsDir, { recursive: true });
      console.log('_posts 폴더 이동 완료');
    }

    if (fs.existsSync(sourceImgDir)) {
      await copyDir(sourceImgDir, targetImgDir);
      await fs.promises.rm(sourceImgDir, { recursive: true });
      console.log('assets/img 폴더 이동 완료');
    }
  } catch (error) {
    console.error('폴더 이동 중 에러 발생:', error);
  }
};

export const main = async () => {
  await runProcess();
  await moveDirectories();
};
