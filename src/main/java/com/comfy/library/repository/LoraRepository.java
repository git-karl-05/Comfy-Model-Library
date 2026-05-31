package com.comfy.library.repository;

import com.comfy.library.entity.LoraCategory;
import com.comfy.library.entity.LoraEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LoraRepository extends JpaRepository<LoraEntity, Long> {

    List<LoraEntity> findByLoraNameContainingIgnoreCase(String keyword);

    List<LoraEntity> findByCategory(LoraCategory category);

    List<LoraEntity> findByGroupNameIgnoreCase(String groupName);

    List<LoraEntity> findByFavoriteTrue();

    List<LoraEntity> findAllByOrderByGroupNameAsc();
}